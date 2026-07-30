"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function NavLink({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: string;
}) {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <Link
      href={href}
      className={`flex flex-col items-center gap-0.5 text-xs px-3 py-1 rounded-xl transition-colors ${
        isActive ? "text-amber-600 font-semibold" : "text-ink-dim hover:text-ink"
      }`}
    >
      <span className="text-xl leading-none">{icon}</span>
      {label}
    </Link>
  );
}
