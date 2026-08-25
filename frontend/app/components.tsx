import type { ReactNode } from "react";
import Link from "next/link";

/* ── Nav ──────────────────────────────────────────────────── */
export function Nav({ active }: { active: "home" | "rag" | "ask" }) {
  const link =
    "text-subtle no-underline text-sm tracking-widest uppercase transition-colors hover:text-fg";
  return (
    <nav className="border-b border-rim py-4 relative z-10">
      <div className="flex justify-between items-center max-w-[1100px] mx-auto px-8">
        <Link href="/" className="font-serif text-xl text-gold no-underline tracking-[0.06em]">
          E·RAG
        </Link>
        <ul className="flex gap-8 list-none">
          <li>
            <Link href="/" className={`${link} ${active === "home" ? "!text-fg" : ""}`}>
              Overview
            </Link>
          </li>
          <li>
            <Link href="/rag" className={`${link} ${active === "rag" ? "!text-fg" : ""}`}>
              Query
            </Link>
          </li>
          <li>
            <Link href="/ask" className={`${link} ${active === "ask" ? "!text-fg" : ""}`}>
              Ask
            </Link>
          </li>
          <li>
            <a href="/api/docs" target="_blank" rel="noopener noreferrer" className={link}>
              API Docs
            </a>
          </li>
        </ul>
      </div>
    </nav>
  );
}

/* ── Section label with trailing rule ────────────────────── */
export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <span className="text-subtle text-xs tracking-[0.2em] uppercase whitespace-nowrap">
        {children}
      </span>
      <div className="flex-1 h-px bg-rim" />
    </div>
  );
}
