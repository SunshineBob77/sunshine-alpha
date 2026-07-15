import { supabase } from "./supabaseClient";

export type SpaceRole = "owner" | "member";

export type MySpace = {
  id: string;
  name: string;
  icon: string;
  color: string;
  border: string;
  ownerUserId: string;
  createdAt: string;
  role: SpaceRole;
};

export type SpaceMember = {
  userId: string;
  role: SpaceRole;
  joinedAt: string;
  displayName: string | null;
  avatarUrl: string | null;
};

async function requireCurrentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error("Not authenticated");
  return data.user.id;
}

// Two plain queries rather than one embedded select (spaces with an
// inner-joined space_members filter) - PostgREST embedding through a
// filtered inner join is easy to get subtly wrong (and harder to verify
// against RLS behavior), while this is simple enough to reason about
// directly: space_members' own SELECT policy already scopes the first
// query to rows the caller can see (their own active memberships), and
// spaces' SELECT policy does the same for the second.
export async function fetchMySpaces(): Promise<MySpace[]> {
  const userId = await requireCurrentUserId();

  const { data: memberRows, error: memberError } = await supabase
    .from("space_members")
    .select("space_id, role")
    .eq("user_id", userId)
    .is("removed_at", null);

  if (memberError) throw memberError;
  if (!memberRows || memberRows.length === 0) return [];

  const roleBySpaceId = new Map(
    memberRows.map((row) => [row.space_id as string, row.role as SpaceRole])
  );

  const { data: spaceRows, error: spaceError } = await supabase
    .from("spaces")
    .select("id, name, icon, color, border, owner_user_id, created_at")
    .in("id", Array.from(roleBySpaceId.keys()));

  if (spaceError) throw spaceError;

  return (spaceRows ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    icon: row.icon,
    color: row.color,
    border: row.border,
    ownerUserId: row.owner_user_id,
    createdAt: row.created_at,
    role: roleBySpaceId.get(row.id) ?? "member",
  }));
}

// Only active (user_id not null) members - a pending invited_email row
// with no user_id yet has no profile to join against. Invite links (see
// createInviteLink/redeemInvite below) don't create invited_email rows at
// all - a redemption inserts a real, immediately-active member row
// directly - so this doesn't need to change for that mechanism either.
export async function fetchSpaceMembers(spaceId: string): Promise<SpaceMember[]> {
  const { data: memberRows, error: memberError } = await supabase
    .from("space_members")
    .select("user_id, role, joined_at")
    .eq("space_id", spaceId)
    .is("removed_at", null)
    .not("user_id", "is", null);

  if (memberError) throw memberError;
  if (!memberRows || memberRows.length === 0) return [];

  const userIds = memberRows.map((row) => row.user_id as string);

  const { data: profileRows, error: profileError } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url")
    .in("id", userIds);

  if (profileError) throw profileError;

  const profileById = new Map((profileRows ?? []).map((row) => [row.id, row]));

  return memberRows.map((row) => {
    const profile = profileById.get(row.user_id as string);
    return {
      userId: row.user_id as string,
      role: row.role as SpaceRole,
      joinedAt: row.joined_at,
      displayName: profile?.display_name ?? null,
      avatarUrl: profile?.avatar_url ?? null,
    };
  });
}

// Only inserts into `spaces` - the on_space_created trigger (see
// shared-spaces-schema.sql) auto-inserts the owner's own space_members
// row with role='owner', so this doesn't insert into space_members
// itself. Verified empirically (see audit) rather than assumed.
export async function createSharedSpace(name: string): Promise<MySpace> {
  const userId = await requireCurrentUserId();

  const { data, error } = await supabase
    .from("spaces")
    .insert({ name, owner_user_id: userId })
    .select("id, name, icon, color, border, owner_user_id, created_at")
    .single();

  if (error) throw error;

  return {
    id: data.id,
    name: data.name,
    icon: data.icon,
    color: data.color,
    border: data.border,
    ownerUserId: data.owner_user_id,
    createdAt: data.created_at,
    role: "owner",
  };
}

export type InviteLink = {
  token: string;
  expiresAt: string | null;
};

export type InvitePreview = {
  spaceName: string;
  spaceIcon: string;
  isValid: boolean;
};

export type RedeemedInvite = {
  spaceId: string;
  role: SpaceRole;
};

// Only inserts into invite_links - token/expires_at (30 days out)/
// use_count all come from DB defaults (see space-invite-links-schema.sql)
// rather than being computed here, so the actual secret generation and
// the expiry default both live in one place, not duplicated client-side.
export async function createInviteLink(spaceId: string): Promise<InviteLink> {
  const userId = await requireCurrentUserId();

  const { data, error } = await supabase
    .from("invite_links")
    .insert({ space_id: spaceId, created_by: userId })
    .select("token, expires_at")
    .single();

  if (error) throw error;

  return { token: data.token, expiresAt: data.expires_at };
}

// Non-destructive - safe to call before the user has committed to
// joining (and even before they're signed in at all; preview_invite
// grants EXECUTE to anon specifically for the "receive a link, then sign
// up" flow). Calls the SECURITY DEFINER preview_invite() rather than
// querying invite_links directly - there's no general SELECT policy on
// that table by design (see the schema doc), since knowing the token is
// what should authorize you, not being logged in.
export async function previewInvite(token: string): Promise<InvitePreview> {
  const { data, error } = await supabase.rpc("preview_invite", { check_token: token });
  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("Invite link not found.");

  return {
    spaceName: row.space_name,
    spaceIcon: row.space_icon,
    isValid: row.is_valid,
  };
}

// Actually joins the caller to the space as role='member' (never owner -
// redeem_invite() doesn't even accept a role argument). Goes through the
// SECURITY DEFINER redeem_invite() rather than a client-side insert,
// since checking validity and incrementing use_count atomically isn't
// something an RLS WITH CHECK can express safely - see the schema doc.
// Any invalid/expired/revoked/exhausted link surfaces as a thrown error
// with the exact message redeem_invite() raised.
//
// The RPC's own result columns are out_space_id/out_role, not
// space_id/role - RETURNS TABLE(...) implicitly declares its columns as
// PL/pgSQL variables for the whole function body, which collided with a
// bare `space_id` reference in an ON CONFLICT target list inside
// redeem_invite() (caught live during verification - see the schema
// doc's note above that function). The prefix is purely an internal SQL
// naming detail; this function still exposes the clean spaceId/role
// shape to every caller.
export async function redeemInvite(token: string): Promise<RedeemedInvite> {
  const { data, error } = await supabase.rpc("redeem_invite", { check_token: token });
  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("Couldn't redeem invite link.");

  return { spaceId: row.out_space_id, role: row.out_role as SpaceRole };
}

// Convenience-only owner check before attempting the update - calls the
// same security-definer helper the RLS policy itself uses
// (is_space_owner), rather than re-deriving "is owner" client-side. This
// is NOT the actual security boundary; the space_members UPDATE policy
// ("Owner can update members (soft-remove)", is_space_owner-gated) is -
// this check just turns a silent 0-rows-affected RLS rejection into a
// clear thrown error instead.
export async function removeMember(spaceId: string, userId: string): Promise<void> {
  const currentUserId = await requireCurrentUserId();

  const { data: isOwner, error: ownerCheckError } = await supabase.rpc("is_space_owner", {
    check_space_id: spaceId,
    check_user_id: currentUserId,
  });

  if (ownerCheckError) throw ownerCheckError;
  if (!isOwner) throw new Error("Only the space owner can remove a member.");

  const { data, error } = await supabase
    .from("space_members")
    .update({ removed_at: new Date().toISOString() })
    .eq("space_id", spaceId)
    .eq("user_id", userId)
    .is("removed_at", null)
    .select();

  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error("Couldn't remove member - they may already be removed.");
  }
}

// Relies on the "Members can remove themselves" policy (see
// space-members-self-leave-schema.sql) - narrowly scoped to flipping the
// caller's own, currently-active removed_at from null to non-null only.
// No code change was needed here once that policy existed: this was
// already written to attempt exactly that update and surface a clear
// error if RLS rejected it, rather than assuming success.
export async function leaveSpace(spaceId: string): Promise<void> {
  const currentUserId = await requireCurrentUserId();

  const { data, error } = await supabase
    .from("space_members")
    .update({ removed_at: new Date().toISOString() })
    .eq("space_id", spaceId)
    .eq("user_id", currentUserId)
    .is("removed_at", null)
    .select();

  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error(
      "Couldn't leave the space - this currently requires a schema/RLS fix (see audit notes: no policy lets a member soft-remove their own membership)."
    );
  }
}
