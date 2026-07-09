import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchShare } from "@/app/lib/shares";
import { caveat } from "@/app/lib/fonts";
import DropContent from "@/app/components/DropContent";
import InviteSection from "@/app/components/InviteSection";
import { getCategoryTone } from "@/app/lib/categoryTone";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ name?: string }>;
};

function stripMarkdown(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_~]{1,3}([^*_~]+)[*_~]{1,3}/g, "$1")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/\|/g, " ")
    .replace(/\n+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { id } = await params;

  if (id === "invite") {
    const { name } = await searchParams;
    const title = name ? `${name} invited you to Sunshine` : "You're invited to Sunshine";
    const description =
      "Sunshine is a personal place to capture ideas, reminders, notes, and everything life throws at you — and share it with the people who matter.";

    return {
      title,
      description,
      openGraph: { title, description, type: "website", siteName: "Sunshine" },
      twitter: { card: "summary_large_image", title, description },
    };
  }

  const share = await fetchShare(id);

  if (!share) notFound();

  const title = `A drop of sunshine from ${share.sharerName}`;
  const plainPreview = stripMarkdown(share.previewText);
  const description =
    plainPreview.length > 160 ? `${plainPreview.slice(0, 160)}…` : plainPreview;

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

function BrandMark() {
  return (
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
  );
}

function ShareFooter() {
  return (
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
  );
}

export default async function SharePage({ params, searchParams }: Props) {
  const { id } = await params;

  if (id === "invite") {
    const { name } = await searchParams;

    return (
      <div className="bg-white rounded-[20px] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.06)] overflow-hidden">
        <div className="px-8 pt-9 pb-6 text-center">
          <BrandMark />
          <p
            className={`${caveat.className} text-4xl font-bold text-[#E5A417] inline-block relative`}
          >
            Sunshine
            <span className="absolute left-0.5 right-0.5 -bottom-0.5 h-0.5 bg-[#F2C868] rounded-full" />
          </p>
        </div>

        <div className="px-6 pb-6">
          <InviteSection name={name ?? null} />
        </div>

        <ShareFooter />
      </div>
    );
  }

  const share = await fetchShare(id);

  if (!share) notFound();

  const tone = getCategoryTone(share.category ?? "");

  return (
    <div className="bg-white rounded-[20px] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.06)] overflow-hidden">
      <div className="px-8 pt-9 pb-6 text-center">
        <BrandMark />

        <p className="text-sm text-[#7A7568]">A drop of sunshine from</p>
        <p
          className={`${caveat.className} text-4xl font-bold text-[#E5A417] mt-0.5 inline-block relative`}
        >
          {share.sharerName.split(" ")[0]}
          <span className="absolute left-0.5 right-0.5 -bottom-0.5 h-0.5 bg-[#F2C868] rounded-full" />
        </p>
      </div>

      <div className="px-6 pb-5">
        <div className={`bg-[#FAF9F5] rounded-2xl border-[5px] ${tone.border} p-5`}>
          <div className="flex items-start gap-3 mb-3">
            <span
              className={`flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-full text-xl ${tone.bg}`}
            >
              {tone.icon}
            </span>

            <div className="min-w-0">
              <p className="font-semibold text-base sm:text-lg text-[#2A281F] truncate">
                {share.title}
              </p>
              <p className="text-sm text-[#7A7568] mt-0.5">
                {share.category ?? "Memory"} · {new Date(share.createdAt).toLocaleString()}
              </p>
            </div>
          </div>

          <div className="text-base leading-relaxed text-[#2A281F]">
            <DropContent content={share.previewText} />
          </div>
        </div>
      </div>

      <div className="px-6 pb-6">
        <InviteSection name={share.sharerName.split(" ")[0]} />
      </div>

      <ShareFooter />
    </div>
  );
}
