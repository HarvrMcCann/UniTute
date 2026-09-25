import type { BlockOf } from "@/lib/course/schema";

export function CodeBlock({ block }: { block: BlockOf<"code"> }) {
  return (
    <figure>
      <pre className="scroll-thin overflow-x-auto rounded-2xl border border-line bg-code p-4 text-[0.9rem] leading-relaxed">
        <code data-language={block.language}>{block.code}</code>
      </pre>
      {block.caption && <figcaption className="mt-2 text-sm text-muted">{block.caption}</figcaption>}
    </figure>
  );
}
