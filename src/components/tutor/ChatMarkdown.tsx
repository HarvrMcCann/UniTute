"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { rehypeLooseMath } from "@/lib/looseMath";

const components: Components = {
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
  table: ({ children }) => (
    <div className="table-scroll">
      <table>{children}</table>
    </div>
  ),
};

/**
 * A tutor reply: markdown with KaTeX maths, rendered in the browser (replies arrive live).
 * Loaded lazily with the tutor. Each exchange is linked to the lesson through its question, so any
 * part IDs the tutor writes ([[b-...]], from older replies) are dropped.
 */
export default function ChatMarkdown({ text }: { text: string }) {
  const source = text.replace(/\s?\[\[?b-[\w-]+\]\]?/g, "");
  return (
    <div className="prose-lesson prose-chat">
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex, rehypeLooseMath]} components={components}>
        {source}
      </ReactMarkdown>
    </div>
  );
}
