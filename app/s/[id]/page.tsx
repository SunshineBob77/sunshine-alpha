import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchShare } from "@/app/lib/shares";

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const share = await fetchShare(id);

  if (!share) notFound();

  const title = `${share.sharerName} shared a memory with you via Sunshine`;
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

const valueProps = [
  { icon: "🤗", label: "Warm & welcoming" },
  { icon: "✨", label: "Clean & beautiful" },
  { icon: "🔒", label: "Private & secure" },
  { icon: "💛", label: "Made for sharing" },
];

export default async function SharePage({ params }: Props) {
  const { id } = await params;
  const share = await fetchShare(id);

  if (!share) notFound();

  return (
    <>
      <div className="flex flex-col items-center text-center mb-8">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-4xl">🌞</span>
          <span className="text-3xl font-bold text-gray-900">sunshine</span>
        </div>
        <p className="text-gray-500">Remember everything. Live more.</p>
      </div>

      <div className="bg-white rounded-3xl ring-1 ring-black/5 shadow-sm p-7 text-center">
        <p className="text-lg font-semibold text-gray-900 mb-5">
          {share.sharerName} shared a memory with you via Sunshine ☀️
        </p>

        <div className="bg-amber-50 rounded-2xl p-5 text-left">
          <p className="font-semibold text-amber-800 break-words">{share.title}</p>
          <p className="text-gray-700 mt-2 break-words">{share.previewText}</p>
        </div>

        <a
          href="/"
          className="mt-6 block w-full bg-gradient-to-r from-amber-400 to-orange-300 hover:from-amber-500 hover:to-orange-400 text-gray-900 font-bold py-4 px-6 rounded-2xl shadow-md shadow-amber-200/60 text-lg transition-all"
        >
          View in Sunshine
        </a>

        <p className="text-sm text-gray-500 mt-3">No account required to view</p>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-8">
        {valueProps.map((prop) => (
          <div
            key={prop.label}
            className="bg-white/70 rounded-2xl ring-1 ring-black/5 p-4 text-center"
          >
            <div className="text-2xl mb-1">{prop.icon}</div>
            <p className="text-sm font-semibold text-gray-700">{prop.label}</p>
          </div>
        ))}
      </div>
    </>
  );
}
