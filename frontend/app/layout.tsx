import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Enterprise RAG — Retrieval-Augmented Generation",
  description:
    "A hybrid semantic + keyword retrieval system powered by pgvector and Gemini embeddings.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
