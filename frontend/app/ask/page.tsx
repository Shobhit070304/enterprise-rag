"use client";

import { useEffect, useRef, useState } from "react";
import { Nav, SectionLabel } from "../components";

const API = process.env.NEXT_PUBLIC_BACKEND_URL;

interface AskResponse {
  query: string;
  answer: string;
  source: "cache" | "documents_retrieved" | "empty";
  similarity?: number;
}

interface HistoryEntry {
  id: number;
  query: string;
  answer: string;
  source: AskResponse["source"];
  similarity?: number;
  timestamp: Date;
}

/* ── Typewriter hook ───────────────────────────────────────── */
function useTypewriter(text: string, speed = 12) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    setDisplayed("");
    setDone(false);
    if (!text) return;
    let i = 0;
    const id = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(id);
        setDone(true);
      }
    }, speed);
    return () => clearInterval(id);
  }, [text, speed]);

  return { displayed, done };
}

/* ── Source badge ──────────────────────────────────────────── */
function SourceBadge({
  source,
  similarity,
}: {
  source: AskResponse["source"];
  similarity?: number;
}) {
  if (source === "cache") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs tracking-[0.1em] uppercase border border-gold/40 text-gold px-2.5 py-0.5">
        <span className="w-1.5 h-1.5 rounded-full bg-gold pulse-dot" />
        cache hit
        {similarity !== undefined && (
          <span className="text-gold/60 ml-1">· {(similarity * 100).toFixed(1)}%</span>
        )}
      </span>
    );
  }
  if (source === "documents_retrieved") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs tracking-[0.1em] uppercase border border-rim text-subtle px-2.5 py-0.5">
        <span className="w-1.5 h-1.5 rounded-full bg-subtle" />
        retrieved
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs tracking-[0.1em] uppercase border border-danger/40 text-danger px-2.5 py-0.5">
      no documents
    </span>
  );
}

/* ── Single answer card ────────────────────────────────────── */
function AnswerCard({ entry, animate }: { entry: HistoryEntry; animate: boolean }) {
  const { displayed, done } = useTypewriter(animate ? entry.answer : "", 8);

  const shownText = animate ? displayed : entry.answer;
  const showCursor = animate && !done;

  return (
    <div className="border border-rim bg-surface">
      {/* Card header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-rim">
        <div className="flex items-center gap-3">
          <span className="text-gold font-serif text-sm">⊕</span>
          <span className="text-fg text-sm leading-snug max-w-[480px] truncate" title={entry.query}>
            {entry.query}
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <SourceBadge source={entry.source} similarity={entry.similarity} />
          <span className="text-subtle text-xs">
            {entry.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      </div>

      {/* Answer body */}
      <div className="px-6 py-5">
        <p className="text-ink text-sm leading-[1.85] whitespace-pre-wrap">
          {shownText}
          {showCursor && <span className="text-gold animate-pulse">▌</span>}
        </p>
      </div>
    </div>
  );
}

/* ── Main page ─────────────────────────────────────────────── */
export default function AskPage() {
  const [query, setQuery] = useState("");
  const [topK, setTopK] = useState(3);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [latestId, setLatestId] = useState<number | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to latest answer
  useEffect(() => {
    if (latestId !== null) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
    }
  }, [latestId]);

  async function handleAsk() {
    const q = query.trim();
    if (!q || loading) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, top_k: topK }),
      });
      const data: AskResponse = await res.json();
      if (!res.ok) throw new Error((data as { detail?: string }).detail ?? "Request failed");

      const entry: HistoryEntry = {
        id: Date.now(),
        query: data.query,
        answer: data.answer,
        source: data.source,
        similarity: data.similarity,
        timestamp: new Date(),
      };
      setHistory((prev) => [entry, ...prev]);
      setLatestId(entry.id);
      setQuery("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  const inputCls =
    "flex-1 bg-[#0f0e0b] border border-rim text-fg font-sans text-sm px-4 py-3 outline-none " +
    "transition-colors focus:border-gold-dim placeholder:text-subtle placeholder:opacity-60 leading-relaxed";

  const btnCls =
    "inline-flex items-center gap-2 font-sans text-sm tracking-[0.08em] uppercase " +
    "px-6 py-3 border border-gold text-gold bg-transparent hover:bg-gold hover:text-bg " +
    "transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0";

  return (
    <div className="relative z-[1] min-h-screen flex flex-col bg-bg text-fg font-sans">
      <Nav active="ask" />

      <div className="max-w-[1100px] mx-auto px-8 w-full pt-8 flex-1 flex flex-col">

        {/* ── Page header ──────────────────────────────────── */}
        <div className="border-b border-rim pb-6 mb-8">
          <p className="text-subtle text-xs tracking-[0.22em] uppercase mb-2">AI Answer Engine</p>
          <h1 className="font-serif text-[1.75rem] text-fg">
            Ask your documents<em className="text-gold">,</em>
          </h1>
          <p className="text-subtle text-sm mt-2 max-w-[560px] leading-[1.7]">
            Queries are semantically cached. On a cache miss, hybrid retrieval + Gemini generates
            a grounded answer. Results are stored for 24h.
          </p>
        </div>

        {/* ── Input row ────────────────────────────────────── */}
        <div className="flex gap-2 mb-2">
          <input
            ref={inputRef}
            id="ask-input"
            type="text"
            className={inputCls}
            placeholder="Ask a question about your ingested documents…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAsk()}
            disabled={loading}
          />
          <div className="flex flex-col gap-1 shrink-0 w-20">
            <label className="text-subtle text-xs tracking-[0.1em] uppercase px-1">Top K</label>
            <input
              id="top-k"
              type="number"
              min={1}
              max={10}
              value={topK}
              onChange={(e) => setTopK(Number(e.target.value))}
              className="bg-[#0f0e0b] border border-rim text-fg font-sans text-sm px-3 py-3 outline-none focus:border-gold-dim transition-colors w-full"
            />
          </div>
          <button
            id="ask-btn"
            className={btnCls}
            onClick={handleAsk}
            disabled={loading || !query.trim()}
          >
            {loading ? <span className="spinner" /> : null}
            {loading ? "Thinking…" : "Ask →"}
          </button>
        </div>

        {/* ── Error ────────────────────────────────────────── */}
        {error && (
          <div className="mb-4 text-sm px-4 py-2.5 border-l-2 border-danger bg-danger/5 text-danger">
            {error}
          </div>
        )}

        {/* ── Metrics bar ──────────────────────────────────── */}
        {history.length > 0 && (
          <div className="flex gap-6 border-b border-rim py-3 mb-6">
            <StatPill label="Total queries" value={history.length} />
            <StatPill
              label="Cache hits"
              value={history.filter((h) => h.source === "cache").length}
              highlight
            />
            <StatPill
              label="Retrieved"
              value={history.filter((h) => h.source === "documents_retrieved").length}
            />
          </div>
        )}

        {/* ── Answer feed ──────────────────────────────────── */}
        <div className="flex-1 flex flex-col gap-4 pb-10">

          {/* Empty state */}
          {history.length === 0 && !loading && (
            <div className="border border-rim bg-surface p-8 flex flex-col items-start gap-5">
              <SectionLabel>How it works</SectionLabel>
              <div className="grid grid-cols-3 gap-px bg-rim w-full border border-rim">
                {[
                  ["①", "Semantic Cache", "Check if a similar query (≥ 95% similarity) was answered before — instant response."],
                  ["②", "Hybrid Retrieval", "On cache miss, combine vector search + full-text search via Reciprocal Rank Fusion."],
                  ["③", "Gemini Generation", "Pass the top-K retrieved chunks to Gemini 2.5 Flash to generate a grounded answer."],
                ].map(([num, title, desc]) => (
                  <div key={title} className="bg-surface p-6">
                    <div className="text-gold text-lg mb-2 font-serif">{num}</div>
                    <div className="text-fg text-sm mb-1">{title}</div>
                    <div className="text-subtle text-xs leading-[1.65]">{desc}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Loading skeleton */}
          {loading && (
            <div className="border border-rim bg-surface animate-pulse">
              <div className="flex items-center gap-3 px-6 py-3 border-b border-rim">
                <span className="spinner" />
                <span className="text-subtle text-sm tracking-[0.08em] uppercase">
                  Processing query…
                </span>
              </div>
              <div className="px-6 py-5 space-y-2">
                <div className="h-3 bg-rim rounded w-3/4" />
                <div className="h-3 bg-rim rounded w-1/2" />
                <div className="h-3 bg-rim rounded w-5/6" />
              </div>
            </div>
          )}

          {/* Answer cards */}
          {history.map((entry) => (
            <AnswerCard
              key={entry.id}
              entry={entry}
              animate={entry.id === latestId}
            />
          ))}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* ── Footer ───────────────────────────────────────────── */}
      <footer className="border-t border-rim py-5">
        <div className="max-w-[1100px] mx-auto px-8 flex justify-between items-center text-xs text-subtle tracking-[0.06em]">
          <span>Enterprise RAG · v0.1.0</span>
          <span>Gemini 2.5 Flash · Redis · pgvector</span>
        </div>
      </footer>
    </div>
  );
}

/* ── Small stat pill ───────────────────────────────────────── */
function StatPill({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className={`text-sm font-serif ${highlight ? "text-gold" : "text-fg"}`}>{value}</span>
      <span className="text-subtle text-xs tracking-[0.08em] uppercase">{label}</span>
    </div>
  );
}
