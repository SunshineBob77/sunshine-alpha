import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchShare } from "@/app/lib/shares";
import { caveat } from "@/app/lib/fonts";

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const share = await fetchShare(id);

  if (!share) notFound();

  const title = `A drop of sunshine from ${share.sharerName}`;
  const description =
    share.previewText.length > 160
      ? `${share.previewText.slice(0, 160)}…`
      : share.previewText;

  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description,
      type: "article",
      siteName: "Sunshine",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

const categoryTags: Record<
  string,
  { label: string; bg: string; text: string; icon: React.ReactNode }
> = {
  Achievement: {
    label: "Achievement",
    bg: "#E8F3E6",
    text: "#3D7A3F",
    icon: (
      <path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z" />
    ),
  },
  Work: {
    label: "Work",
    bg: "#E3ECFB",
    text: "#2F5FA8",
    icon: (
      <>
        <rect x="2" y="7" width="20" height="14" rx="2" />
        <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
      </>
    ),
  },
  Task: {
    label: "Task",
    bg: "#FEF3D7",
    text: "#A8760A",
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M9 12l2 2 4-4" />
      </>
    ),
  },
  Memory: {
    label: "Memory",
    bg: "#F1E9F7",
    text: "#7A4E96",
    icon: <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />,
  },
};

function getCategoryTag(category: string | null) {
  return categoryTags[category ?? ""] ?? categoryTags.Memory;
}

export default async function SharePage({ params }: Props) {
  const { id } = await params;
  const share = await fetchShare(id);

  if (!share) notFound();

  const tag = getCategoryTag(share.category);

  return (
    <div className="bg-white rounded-[20px] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.06)] overflow-hidden">
      <div className="px-8 pt-9 pb-6 text-center">
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

        <p className="text-sm text-[#7A7568]">A drop of sunshine from</p>
        <p
          className={`${caveat.className} text-4xl font-bold text-[#E5A417] mt-0.5 inline-block relative`}
        >
          {share.sharerName.split(" ")[0]}
          <span className="absolute left-0.5 right-0.5 -bottom-0.5 h-0.5 bg-[#F2C868] rounded-full" />
        </p>
      </div>

      <div className="px-6 pb-5">
        <div className="bg-[#FAF9F5] rounded-2xl p-[18px]">
          <span
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide px-3 py-1.5 rounded-full mb-3"
            style={{ backgroundColor: tag.bg, color: tag.text }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {tag.icon}
            </svg>
            {tag.label}
          </span>

          <p className="text-base leading-relaxed text-[#2A281F] break-words">
            {share.previewText}
          </p>
        </div>
      </div>

      <div className="px-6 pb-6">
        <div className="rounded-2xl bg-gradient-to-br from-[#FFFBEF] to-[#FEF3D7] ring-1 ring-[#F2C868]/40 p-5 text-center">
          <p className="text-sm font-semibold text-[#92400E] mb-1">🌞 What is Sunshine?</p>
          <p className="text-sm text-[#5B5647] leading-relaxed">
            Sunshine is a personal companion for capturing anything on your mind — a note, an
            idea, a task, a place to remember — and quietly organizing it for you.{" "}
            {share.sharerName.split(" ")[0]} uses it to drop things in without having to sort
            them, and Sunshine does the rest: finding answers, pulling out addresses, and keeping
            everything easy to find later.
          </p>
          <a
            href="/?mode=signup"
            className="inline-flex items-center justify-center gap-2 mt-4 bg-[#1B2340] hover:bg-[#141a30] text-white text-sm font-semibold px-5 py-3 rounded-full transition-colors"
          >
            Sign up free — it takes a minute
          </a>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 px-6 py-5 border-t border-[#F0EDE4]">
        <div className="flex items-center gap-2.5 text-[13px] leading-tight text-[#7A7568]">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#B5B0A2" strokeWidth="2" className="shrink-0">
            <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.6z" />
          </svg>
          <span>
            Drop it into Sunshine.
            <br />
            Sunshine does the rest.
          </span>
        </div>

        <a
          href="/"
          className="inline-flex items-center gap-2 whitespace-nowrap bg-[#1B2340] text-white text-sm font-semibold px-5 py-3 rounded-full shrink-0"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#FBC02D">
            <circle cx="12" cy="12" r="5" />
            <path
              d="M12 1v3M12 20v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M1 12h3M20 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"
              stroke="#FBC02D"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
          Try Sunshine
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </a>
      </div>
    </div>
  );
}
