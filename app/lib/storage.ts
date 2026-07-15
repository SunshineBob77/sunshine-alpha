import { supabase } from "./supabaseClient";

// Photo/Gallery/File capture v1 - see docs/photo-file-capture-schema.sql
// for the bucket + RLS this relies on. One private bucket for both image
// and generic file attachments; visibility is entirely RLS-driven (mirrors
// whoever can already see the parent Drop), so nothing here needs to know
// about ownership or Shared Spaces itself.
const BUCKET = "drop-attachments";

function extensionFromFile(file: File): string {
  const fromName = file.name.split(".").pop();
  if (fromName && fromName.length < file.name.length) return fromName.toLowerCase();
  // Camera-captured blobs often have no real filename/extension at all -
  // fall back to the MIME subtype (e.g. "image/jpeg" -> "jpeg").
  return file.type.split("/")[1] ?? "bin";
}

async function uploadToDropAttachments(captureId: number, file: File): Promise<string> {
  const path = `${captureId}/${crypto.randomUUID()}.${extensionFromFile(file)}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type || undefined });

  if (error) throw error;
  return path;
}

// Photo/Gallery path - same upload mechanics as a File, kept as a
// separate export purely so callers' intent stays explicit.
export async function uploadDropImage(captureId: number, file: File): Promise<string> {
  return uploadToDropAttachments(captureId, file);
}

// File path - also returns the original filename, since a non-image
// attachment has no thumbnail to render and needs something to label the
// chip/link with (the storage object's own generated path is a uuid, not
// human-readable).
export async function uploadDropFile(
  captureId: number,
  file: File
): Promise<{ path: string; name: string }> {
  const path = await uploadToDropAttachments(captureId, file);
  return { path, name: file.name };
}

// One-hour expiry - long enough for a normal viewing session, short
// enough that a cached/leaked link doesn't stay valid indefinitely. Every
// caller (DropAttachmentImage) requests a fresh one on mount rather than
// persisting it, so this is a soft ceiling, not a hard one.
const SIGNED_URL_EXPIRY_SECONDS = 60 * 60;

export async function getSignedAttachmentUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_EXPIRY_SECONDS);

  if (error) throw error;
  return data.signedUrl;
}
