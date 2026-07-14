import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function DropContent({
  content,
  className = "",
  variant = "light",
}: {
  content: string;
  className?: string;
  // "light" (default) is the existing, unchanged appearance - used by
  // DropDetailModal and anything else that doesn't pass this prop. "dark"
  // is scoped to the Lifeline feed screen's restyle only.
  variant?: "light" | "dark";
}) {
  const isDark = variant === "dark";

  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
          ul: ({ children }) => <ul className="list-disc ml-5 mb-2 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal ml-5 mb-2 space-y-1">{children}</ol>,
          li: ({ children }) => <li className="break-words">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className={isDark ? "text-gold underline" : "text-amber-700 underline"}
            >
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto mb-2">
              <table className="min-w-full text-sm border-collapse">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className={isDark ? "bg-ink/10" : "bg-gray-100"}>{children}</thead>
          ),
          th: ({ children }) => (
            <th
              className={`px-2 py-1 text-left font-semibold border ${
                isDark ? "border-ink/10" : "border-gray-200"
              }`}
            >
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className={`px-2 py-1 border ${isDark ? "border-ink/10" : "border-gray-200"}`}>
              {children}
            </td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
