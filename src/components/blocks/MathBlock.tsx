import katex from "katex";
import type { BlockOf } from "@/lib/course/schema";

export function MathBlock({ block }: { block: BlockOf<"math"> }) {
  const html = katex.renderToString(block.latex, { displayMode: true, throwOnError: false });
  return (
    <figure>
      <div dangerouslySetInnerHTML={{ __html: html }} />
      {block.caption && <figcaption className="text-center text-sm text-muted">{block.caption}</figcaption>}
    </figure>
  );
}
