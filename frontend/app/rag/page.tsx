"use client";

import { useState } from "react";
import { Nav, SectionLabel } from "../components";

const API = process.env.NEXT_PUBLIC_BACKEND_URL;

interface RetrieveResult {
  id: number;
  content: string;
  rrf_score: number;
}

/* ── Ingest + Query state & logic ─────────────────────────── */
export default function RagPage() {
  const [ingestText,    setIngestText]    = useState("");
  const [ingestLoading, setIngestLoading] = useState(false);
  const [ingestMsg,     setIngestMsg]     = useState<{ text: string; error?: boolean } | null>(null);

  const [query,        setQuery]        = useState("");
  const [topK,         setTopK]         = useState(3);
  const [queryLoading, setQueryLoading] = useState(false);
  const [results,      setResults]      = useState<RetrieveResult[] | null>(null);
  const [queryError,   setQueryError]   = useState<string | null>(null);

  async function handleIngest() {
    if (!ingestText.trim()) return;
    setIngestLoading(true);
    setIngestMsg(null);
    try {
      const res  = await fetch(`${API}/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document_text: ingestText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Ingestion failed");
      setIngestMsg({ text: data.message });
      setIngestText("");
    } catch (e: unknown) {
      setIngestMsg({ text: e instanceof Error ? e.message : "Unknown error", error: true });
    } finally {
      setIngestLoading(false);
    }
  }

  async function handleQuery() {
    if (!query.trim()) return;
    setQueryLoading(true);
    setQueryError(null);
    setResults(null);
    try {
      const res  = await fetch(`${API}/retrieve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, top_k: topK }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Query failed");
      setResults(data.results);
    } catch (e: unknown) {
      setQueryError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setQueryLoading(false);
    }
  }

  /* ── Shared input classes ─────────────────────────────── */
  const inputCls =
    "w-full bg-[#0f0e0b] border border-rim text-fg font-sans text-sm px-4 py-3 outline-none " +
    "transition-colors focus:border-gold-dim placeholder:text-subtle placeholder:opacity-60 resize-y leading-relaxed";

  const btnPrimary =
    "inline-flex items-center gap-2 font-sans text-sm tracking-[0.08em] uppercase " +
    "px-5 py-2.5 border border-gold text-gold bg-transparent hover:bg-gold hover:text-bg " +
    "transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed";

  return (
    <div className="relative z-[1] min-h-screen flex flex-col bg-bg text-fg font-sans">
      <Nav active="rag" />

      <div className="max-w-[1100px] mx-auto px-8 w-full pt-8 flex-1 flex flex-col">

        {/* ── Page header ───────────────────────────────── */}
        <div className="border-b border-rim pb-6 mb-0">
          <p className="text-subtle text-xs tracking-[0.22em] uppercase mb-2">Query Console</p>
          <h2 className="font-serif text-[1.75rem] text-fg">Retrieval Interface</h2>
          <p className="text-subtle text-sm mt-2">
            Ingest documents and run hybrid semantic + keyword searches.
          </p>
        </div>

        {/* ── Two-column grid ───────────────────────────── */}
        <div className="grid grid-cols-2 mt-8 gap-px bg-rim border border-rim">

          {/* LEFT — Ingest ──────────────────────────────── */}
          <div className="bg-surface p-8">
            <SectionLabel>Document Ingestion</SectionLabel>

            <div className="flex flex-col gap-1 mb-5">
              <label className="text-subtle text-xs tracking-[0.1em] uppercase">Document text</label>
              <textarea
                id="ingest-text"
                rows={10}
                className={inputCls}
                placeholder="Paste your document text here. It will be chunked (500 chars, 50 overlap), embedded via Gemini, and stored in pgvector…"
                value={ingestText}
                onChange={(e) => setIngestText(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-4">
              <button
                id="ingest-btn"
                className={btnPrimary}
                onClick={handleIngest}
                disabled={ingestLoading || !ingestText.trim()}
              >
                {ingestLoading ? <span className="spinner" /> : null}
                {ingestLoading ? "Ingesting…" : "Ingest →"}
              </button>
              {ingestText.length > 0 && (
                <span className="text-subtle text-xs">{ingestText.length} chars</span>
              )}
            </div>

            {ingestMsg && (
              <div
                className={`mt-4 text-sm px-4 py-2.5 border-l-2 ${
                  ingestMsg.error
                    ? "border-danger bg-danger/5 text-danger"
                    : "border-gold bg-gold/5 text-ink"
                }`}
              >
                {ingestMsg.text}
              </div>
            )}

            <div className="border-t border-rim my-7" />
            <SectionLabel>How Ingestion Works</SectionLabel>
            <div className="text-subtle text-sm leading-[1.9] space-y-0.5">
              <div>① Text split — 500 char chunks, 50 overlap</div>
              <div>② Embedded via <span className="text-gold">gemini-embedding-001</span></div>
              <div>③ Stored in <span className="text-gold">pgvector</span> (768-dim)</div>
              <div>④ GIN + HNSW indexes updated automatically</div>
            </div>
          </div>

          {/* RIGHT — Query ──────────────────────────────── */}
          <div className="bg-surface p-8">
            <SectionLabel>Hybrid Retrieval</SectionLabel>

            <div className="flex flex-col gap-1 mb-5">
              <label className="text-subtle text-xs tracking-[0.1em] uppercase">Query</label>
              <input
                type="text"
                id="query-input"
                className={inputCls}
                placeholder="Enter your search query…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleQuery()}
              />
            </div>

            <div className="flex items-end gap-4 mb-0">
              <div className="flex flex-col gap-1 w-24">
                <label className="text-subtle text-xs tracking-[0.1em] uppercase">Top K</label>
                <input
                  type="number"
                  id="top-k"
                  className={inputCls}
                  min={1}
                  max={10}
                  value={topK}
                  onChange={(e) => setTopK(Number(e.target.value))}
                />
              </div>
              <button
                id="query-btn"
                className={btnPrimary}
                onClick={handleQuery}
                disabled={queryLoading || !query.trim()}
              >
                {queryLoading ? <span className="spinner" /> : null}
                {queryLoading ? "Searching…" : "Search →"}
              </button>
            </div>

            <div className="border-t border-rim my-7" />

            {/* Empty state */}
            {!results && !queryError && !queryLoading && (
              <p className="text-subtle text-sm leading-[1.7]">
                Results will appear here. Searches combine vector similarity and
                full-text ranking, fused with RRF (k=60).
              </p>
            )}

            {/* Error */}
            {queryError && (
              <div className="text-sm px-4 py-2.5 border-l-2 border-danger bg-danger/5 text-danger">
                {queryError}
              </div>
            )}

            {/* No results */}
            {results && results.length === 0 && (
              <div className="text-sm px-4 py-2.5 border-l-2 border-gold bg-gold/5 text-ink">
                No results found. Try ingesting some documents first.
              </div>
            )}

            {/* Results list */}
            {results && results.length > 0 && (
              <>
                <SectionLabel>
                  {results.length} Result{results.length !== 1 ? "s" : ""}
                </SectionLabel>
                {results.map((r, i) => (
                  <div key={r.id} className={`py-5 ${i > 0 ? "border-t border-rim" : ""}`}>
                    <div className="flex items-center gap-4 text-xs tracking-[0.12em] text-subtle uppercase mb-2">
                      <span>Rank #{i + 1}</span>
                      <span className="text-gold">rrf={r.rrf_score.toFixed(5)}</span>
                      <span>id:{r.id}</span>
                    </div>
                    <p className="text-ink text-sm leading-[1.7]">{r.content}</p>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* ── Status bar ────────────────────────────────── */}
        <div className="border-t border-rim py-3 flex gap-6 items-center mt-0">
          <HealthIndicator />
          <span className="text-subtle text-xs">Backend: localhost:8000 (proxied)</span>
        </div>
      </div>

      {/* ── Footer ────────────────────────────────────────── */}
      <footer className="border-t border-rim py-5">
        <div className="max-w-[1100px] mx-auto px-8 flex justify-between items-center text-xs text-subtle tracking-[0.06em]">
          <span>Enterprise RAG · v0.1.0</span>
          <span>FastAPI · pgvector · Gemini</span>
        </div>
      </footer>
    </div>
  );
}

/* ── Health ping indicator ────────────────────────────────── */
function HealthIndicator() {
  const [status, setStatus] = useState<"unknown" | "healthy" | "error">("unknown");

  async function check() {
    try {
      const res  = await fetch("/api/health");
      const data = await res.json();
      setStatus(data.status === "healthy" ? "healthy" : "error");
    } catch {
      setStatus("error");
    }
  }

  const dotColor =
    status === "healthy" ? "bg-[#5a9a5a]" :
    status === "error"   ? "bg-danger"    :
                           "bg-subtle";

  const label =
    status === "healthy" ? "API healthy" :
    status === "error"   ? "API unreachable" :
                           "Check health";

  return (
    <button
      onClick={check}
      title="Click to ping /health"
      className="flex items-center gap-2 text-subtle text-xs tracking-[0.08em] uppercase
                 bg-transparent border-none cursor-pointer hover:text-fg transition-colors"
    >
      <span className={`w-2 h-2 rounded-full pulse-dot ${dotColor}`} />
      {label}
    </button>
  );
}
