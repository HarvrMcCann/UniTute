import ReactMarkdown, { type Components } from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

const blockComponents: Components = {
  table: ({ children }) => (
    <div className="table-scroll">
      <table>{children}</table>
    </div>
  ),
};

// Inline use (inside buttons, list items): drop the wrapping <p> so the HTML stays valid.
const inlineComponents: Components = {
  ...blockComponents,
  p: ({ children }) => <>{children}</>,
};

type MarkdownProps = {
  children: string;
  /** Render without paragraph wrappers, for use inside buttons and other inline spots. */
  inline?: boolean;
  className?: string;
};

/** Server-rendered markdown with GFM tables and KaTeX maths ($inline$ and $$display$$). */
export function Markdown({ children, inline = false, className }: MarkdownProps) {
  const content = (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={inline ? inlineComponents : blockComponents}
    >
      {children}
    </ReactMarkdown>
  );
  return inline ? (
    <span className={className}>{content}</span>
  ) : (
    <div className={`prose-lesson ${className ?? ""}`}>{content}</div>
  );
}
