"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

const ANCHOR_HREF = "#tutor-anchor-";

/**
 * A tutor reply: markdown with KaTeX maths, rendered in the browser (replies arrive live).
 * [[b-...]] references become link chips via renderAnchor. Loaded lazily with the tutor.
 */
export default function ChatMarkdown({ text, renderAnchor }: { text: string; renderAnchor: (blockId: string) => React.ReactNode }) {
  const source = text.replace(/\[\[(b-[\w-]+)\]\]/g, (_, id: string) => ` [link](${ANCHOR_HREF}${id})`);
  const components: Components = {
    a: ({ href, children }) =>
      href?.startsWith(ANCHOR_HREF) ? (
        renderAnchor(href.slice(ANCHOR_HREF.length))
      ) : (
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
  return (
    <div className="prose-lesson prose-chat">
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]} components={components}>
        {source}
      </ReactMarkdown>
    </div>
  );
}
