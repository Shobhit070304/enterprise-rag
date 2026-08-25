import Link from "next/link";
import { Nav, SectionLabel } from "./components";

export default function Home() {
  return (
    <div className="relative z-[1] min-h-screen flex flex-col bg-bg text-fg font-sans">
      <Nav active="home" />

      <main className="flex-1">
        <div className="max-w-[1100px] mx-auto px-8">

          {/* ── Hero ──────────────────────────────────────── */}
          <section className="pt-24 pb-16 border-b border-rim">
            <p className="text-subtle text-xs tracking-[0.22em] uppercase mb-5">
              Enterprise Retrieval-Augmented Generation
            </p>
            <h1 className="font-serif text-[3.5rem] leading-[1.1] mb-6 max-w-[680px] cursor">
              Find what matters,<br />
              <em className="text-gold">intelligently.</em>
            </h1>
            <p className="text-subtle text-base max-w-[560px] leading-[1.75] mb-10">
              A hybrid retrieval engine combining semantic vector search and full-text keyword
              indexing, fused via Reciprocal Rank Fusion. Built on pgvector and Gemini embeddings.
            </p>
            <div className="flex gap-4">
              <Link
                href="/rag"
                className="inline-flex items-center gap-2 font-sans text-sm tracking-[0.08em] uppercase
                           px-6 py-3 border border-gold text-gold bg-transparent
                           hover:bg-gold hover:text-bg transition-all no-underline"
              >
                Open Query Console →
              </Link>
              <a
                href="/api/docs"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 font-sans text-sm tracking-[0.08em] uppercase
                           px-6 py-3 border border-rim text-fg bg-transparent
                           hover:border-gold hover:text-gold transition-all no-underline"
              >
                View API
              </a>
            </div>
          </section>

          {/* ── Feature grid ──────────────────────────────── */}
          <div className="grid grid-cols-3 border border-rim mt-12">
            {[
              {
                icon: "◈",
                title: "Vector Search",
                desc: "HNSW index on 768-dimensional Gemini embeddings. Cosine similarity for semantic retrieval.",
              },
              {
                icon: "◉",
                title: "Keyword Search",
                desc: "PostgreSQL GIN index with full-text search and ts_rank scoring for precision recall.",
              },
              {
                icon: "⊕",
                title: "Rank Fusion",
                desc: "Reciprocal Rank Fusion (k=60) merges both retrieval lists into a single coherent ranking.",
              },
            ].map(({ icon, title, desc }, i) => (
              <div key={i} className={`p-7 bg-surface ${i < 2 ? "border-r border-rim" : ""}`}>
                <div className="text-gold text-xl mb-3">{icon}</div>
                <div className="font-serif text-fg text-base mb-2">{title}</div>
                <div className="text-subtle text-sm leading-[1.65]">{desc}</div>
              </div>
            ))}
          </div>

          {/* ── Architecture strip ────────────────────────── */}
          <div className="border-t border-rim my-8" />
          <SectionLabel>System Architecture</SectionLabel>
          <div className="border border-rim bg-surface grid grid-cols-5 text-center">
            {[
              ["CLIENT", "Browser / API"],
              ["INGEST", "/ingest endpoint"],
              ["EMBED",  "Gemini 768-dim"],
              ["STORE",  "pgvector DB"],
              ["FUSE",   "RRF Ranking"],
            ].map(([title, sub], i) => (
              <div key={i} className={`py-5 px-3 ${i < 4 ? "border-r border-rim" : ""}`}>
                <div className="font-serif text-fg text-sm mb-1">{title}</div>
                <div className="text-subtle text-xs">{sub}</div>
              </div>
            ))}
          </div>

          {/* ── API endpoints ─────────────────────────────── */}
          <div className="border-t border-rim my-8" />
          <SectionLabel>API Endpoints</SectionLabel>
          <div className="flex flex-col gap-px">
            {[
              { method: "GET",  path: "/health",   desc: "Health check — returns system status." },
              { method: "POST", path: "/ingest",   desc: "Ingest raw text. Splits into chunks, embeds, and stores in pgvector." },
              { method: "POST", path: "/retrieve", desc: "Hybrid search with top_k results via Reciprocal Rank Fusion." },
            ].map(({ method, path, desc }) => (
              <div key={path} className="border border-rim bg-surface px-6 py-4 flex gap-4 items-start mb-px">
                <span
                  className={`text-xs tracking-[0.1em] border border-rim px-2 py-0.5 shrink-0 mt-0.5
                              ${method === "GET" ? "text-gold" : "text-subtle"}`}
                >
                  {method}
                </span>
                <div>
                  <div className="text-fg text-sm mb-1">{path}</div>
                  <div className="text-subtle text-xs">{desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* ── Tech stack tags ───────────────────────────── */}
          <div className="flex gap-2 flex-wrap mt-10 mb-12 items-center">
            <span className="text-subtle text-xs mr-1">Built with</span>
            {["FastAPI", "PostgreSQL", "pgvector", "asyncpg", "Gemini", "HNSW", "Next.js 16"].map((t) => (
              <span key={t} className="text-xs tracking-[0.1em] uppercase border border-rim text-subtle px-2.5 py-1">
                {t}
              </span>
            ))}
          </div>
        </div>
      </main>

      {/* ── Footer ────────────────────────────────────────── */}
      <footer className="border-t border-rim py-5">
        <div className="max-w-[1100px] mx-auto px-8 flex justify-between items-center text-xs text-subtle tracking-[0.06em]">
          <span>Enterprise RAG · v0.1.0</span>
          <span>FastAPI · localhost:8000</span>
        </div>
      </footer>
    </div>
  );
}
