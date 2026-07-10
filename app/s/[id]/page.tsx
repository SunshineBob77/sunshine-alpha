import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchShare } from "@/app/lib/shares";
import { caveat } from "@/app/lib/fonts";
import { stripMarkdown, truncatePreview } from "@/app/lib/textPreview";
import DropCard from "@/app/components/DropCard";
import InviteSection from "@/app/components/InviteSection";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ name?: string }>;
};

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

  const title = `${share.sharerName} sent you a drop of sunshine ☀️`;
  const plainPreview = stripMarkdown(share.previewText);
  const description = truncatePreview(`${share.title} — ${plainPreview}`, 120);

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

  return (
    <div className="bg-white rounded-[20px] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.06)] overflow-hidden">
      <div className="px-8 pt-8 pb-2 text-center">
        <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-[#FEF3D7] flex items-center justify-center text-lg">
          ☀️
        </div>
        <p className="text-sm text-[#7A7568]">
          Shared by <span className="font-semibold text-[#92400E]">{share.sharerName.split(" ")[0]}</span>
        </p>
      </div>

      <div className="px-6 pb-5">
        <DropCard
          title={share.title}
          spaceId={share.spaceId}
          content={share.previewText}
          createdAt={share.createdAt}
          clipped={false}
        />
      </div>

      {(share.aiResearchResult || share.extractedAddress) && (
        <div className="px-6 pb-5 flex flex-col gap-3">
          {share.aiResearchResult && (
            <div className="rounded-2xl bg-[#FFFBEF] ring-1 ring-[#F0EDE4] p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm bg-[#FEF3D7]">
                  🔎
                </span>
                <h3 className="font-semibold text-sm text-[#2A281F]">Sunshine found this</h3>
              </div>
              <p className="text-sm text-[#5B5647] leading-relaxed break-words">
                {share.aiResearchResult}
              </p>
            </div>
          )}

          {share.extractedAddress && (
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(share.extractedAddress)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 self-start text-xs font-semibold bg-[#FFFBEF] hover:bg-[#FEF3D7] text-[#92400E] ring-1 ring-[#F0EDE4] px-3 py-1.5 rounded-full transition-all"
            >
              📍 Open in Maps
            </a>
          )}
        </div>
      )}

      <div className="px-6 pb-6">
        <InviteSection name={share.sharerName.split(" ")[0]} />
      </div>

      <ShareFooter />
    </div>
  );
}
