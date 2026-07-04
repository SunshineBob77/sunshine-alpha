"use client";

import { supabase } from "@/app/lib/supabaseClient";
import { useCaptures } from "@/app/lib/DashboardContext";

export default function MePage() {
  const { user } = useCaptures();
  const name = user.user_metadata?.full_name || user.email?.split("@")[0] || "there";

  return (
    <main className="flex flex-col items-center p-8">
      <div className="w-full max-w-2xl">
        <h1 className="text-3xl font-bold text-center mb-8 tracking-tight text-gray-900">Me</h1>

        <section className="bg-white rounded-3xl ring-1 ring-black/5 shadow-sm p-7 text-center">
          <div className="text-4xl mb-3">🙂</div>
          <p className="text-xl font-semibold text-gray-900">{name}</p>
          <p className="text-gray-500 mt-1">{user.email}</p>

          <button
            onClick={() => supabase.auth.signOut()}
            className="mt-6 bg-gray-100 hover:bg-gray-200 text-gray-900 font-bold py-3 px-6 rounded-xl transition-all"
          >
            Log out
          </button>
        </section>
      </div>
    </main>
  );
}
