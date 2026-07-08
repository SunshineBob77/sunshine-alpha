import type { Metadata } from "next";
import { caveat } from "@/app/lib/fonts";

export const metadata: Metadata = {
  title: "Sunshine — drop your thoughts, we'll handle the rest",
  description:
    "Sunshine is a personal companion for capturing anything on your mind — a note, an idea, a task, a place to remember — and quietly organizing it for you.",
  openGraph: {
    title: "Sunshine — drop your thoughts, we'll handle the rest",
    description:
      "Sunshine is a personal companion for capturing anything on your mind — a note, an idea, a task, a place to remember — and quietly organizing it for you.",
    type: "website",
    siteName: "Sunshine",
  },
};

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-amber-50 via-orange-50/50 to-white flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-[20px] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.06)] overflow-hidden">
        <div className="px-8 pt-10 pb-6 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#FEF3D7] flex items-center justify-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="5" fill="#E5A417" />
              <path
                d="M12 1v3M12 20v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M1 12h3M20 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"
                stroke="#E5A417"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
              <path
                d="M9.5 12.5c.4.9 1.3 1.5 2.5 1.5s2.1-.6 2.5-1.5"
                stroke="#FFFFFF"
                strokeWidth="1.4"
                strokeLinecap="round"
                fill="none"
              />
              <circle cx="10" cy="10.5" r="0.9" fill="#FFFFFF" />
              <circle cx="14" cy="10.5" r="0.9" fill="#FFFFFF" />
            </svg>
          </div>

          <p
            className={`${caveat.className} text-4xl font-bold text-[#E5A417] inline-block relative`}
          >
            Sunshine
            <span className="absolute left-0.5 right-0.5 -bottom-0.5 h-0.5 bg-[#F2C868] rounded-full" />
          </p>

          <h1 className="text-xl font-bold text-gray-900 mt-4">
            A quiet place to drop your thoughts.
          </h1>
        </div>

        <div className="px-6 pb-5">
          <div className="bg-[#FAF9F5] rounded-2xl p-5">
            <p className="text-base leading-relaxed text-[#2A281F]">
              Sunshine is a personal companion for capturing anything on your mind — a note, an
              idea, a task, a place to remember — and quietly organizing it for you. Drop things
              in without having to sort them, and Sunshine does the rest: finding answers, pulling
              out addresses, and keeping everything easy to find later.
            </p>
          </div>
        </div>

        <div className="px-6 pb-6">
          <a
            href="/?mode=signup"
            className="flex items-center justify-center gap-2 bg-[#1B2340] hover:bg-[#141a30] text-white text-sm font-semibold px-5 py-3.5 rounded-full transition-colors"
          >
            Sign up free — it takes a minute
          </a>
          <a
            href="/"
            className="block text-center text-sm text-gray-500 mt-4 hover:text-gray-700"
          >
            Already have an account? Log in
          </a>
        </div>

        <div className="flex items-center justify-center gap-2.5 px-6 py-5 border-t border-[#F0EDE4] text-[13px] leading-tight text-[#7A7568]">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#B5B0A2" strokeWidth="2" className="shrink-0">
            <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.6z" />
          </svg>
          <span>
            Drop it into Sunshine.
            <br />
            Sunshine does the rest.
          </span>
        </div>
      </div>
    </main>
  );
}
