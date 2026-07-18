"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

// Key used to hand a pending invite token across an email-confirmation
// gap (see the signup branch below and (dashboard)/layout.tsx's recovery
// effect) - sessionStorage rather than the URL, since the confirmation
// link the user eventually clicks comes from their email client, not from
// this page, so there's no query param to carry the token through that
// hop. Scoped to sessionStorage (not localStorage) deliberately - a stale
// leftover token from a long-abandoned signup attempt shouldn't silently
// resurrect itself in some unrelated future session.
const PENDING_JOIN_TOKEN_KEY = "sunshine_pending_join_token";

export default function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"login" | "signup">(
    searchParams.get("mode") === "signup" ? "signup" : "login"
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Present only when this page was reached via the /join/<token>
  // acceptance route's "create an account to join" / "log in" buttons
  // (see app/join/[token]/page.tsx) - absent for every ordinary
  // login/signup, which behaves exactly as before.
  const joinToken = searchParams.get("join");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    const { data, error } =
      mode === "signup"
        ? await supabase.auth.signUp({
            email,
            password,
            options: { data: { full_name: name } },
          })
        : await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    if (data.session) {
      // Immediate session (login always has one; signup does too when the
      // Supabase project doesn't require email confirmation) - hand
      // straight back to the join page with justAuthed=1 so it
      // auto-redeems without a second confirmation tap, since completing
      // this exact signup/login WAS the confirmation. Ordinary
      // login/signup with no joinToken is completely unaffected - falls
      // through with nothing left to do, same as before this feature.
      if (joinToken) router.push(`/join/${joinToken}?justAuthed=1`);
      return;
    }

    // No session yet - only reachable via signup requiring email
    // confirmation (signInWithPassword never succeeds without a session).
    // Ordinary signup keeps its original message unchanged; a
    // joinToken-carrying signup also stashes the token so the recovery
    // effect in (dashboard)/layout.tsx can pick it up and redirect to
    // /join/<token> the moment a session actually appears, whenever/
    // wherever that ends up happening (a later login here, or the emailed
    // confirmation link signing them in directly - both land on an
    // authenticated page under the dashboard layout, which is what that
    // effect watches).
    if (joinToken) {
      sessionStorage.setItem(PENDING_JOIN_TOKEN_KEY, joinToken);
      setInfo(
        "Account created! Check your email to confirm it, then log in — we'll add you to the space you were invited to."
      );
    } else {
      setInfo("Account created! Check your email to confirm it, then log in.");
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-amber-50 via-orange-50/50 to-white flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-sm bg-white rounded-3xl ring-1 ring-black/5 shadow-sm p-8">
        <div className="flex justify-center mb-1">
          <Image src="/sunshine-logo.png" alt="Sunshine" width={1276} height={358} className="h-9 w-auto" priority />
        </div>
        <p className="text-center text-gray-500 mb-6">
          {mode === "login" ? "Log in to your dashboard" : "Create your account"}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" && (
            <input
              type="text"
              placeholder="Your name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              className="w-full border border-gray-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
            />
          )}

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            className="w-full border border-gray-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={6}
            className="w-full border border-gray-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
          />

          {error && <p className="text-sm text-red-600">{error}</p>}
          {info && <p className="text-sm text-emerald-600">{info}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-amber-400 to-orange-300 hover:from-amber-500 hover:to-orange-400 text-gray-900 font-bold py-3 rounded-xl shadow-sm transition-all disabled:opacity-60"
          >
            {loading ? "Please wait…" : mode === "login" ? "Log In" : "Sign Up"}
          </button>
        </form>

        <button
          onClick={() => {
            setMode(mode === "login" ? "signup" : "login");
            setError(null);
            setInfo(null);
          }}
          className="w-full text-center text-sm text-gray-500 mt-5 hover:text-gray-700"
        >
          {mode === "login" ? "Need an account? Sign up" : "Already have an account? Log in"}
        </button>
      </div>
    </main>
  );
}
