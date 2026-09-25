import type { BlockOf } from "@/lib/course/schema";
import { Markdown } from "./Markdown";

const LABELS: Record<BlockOf<"callout">["variant"], string> = {
  keyIdea: "Key idea",
  tip: "Tip",
  warning: "Watch out",
  example: "Example",
};

const COLOURS: Record<BlockOf<"callout">["variant"], string> = {
  keyIdea: "var(--callout-keyidea)",
  tip: "var(--callout-tip)",
  warning: "var(--callout-warning)",
  example: "var(--callout-example)",
};

export function CalloutBlock({ block }: { block: BlockOf<"callout"> }) {
  const colour = COLOURS[block.variant];
  return (
    <aside
      className="rounded-2xl border-l-[3px] px-5 py-4 backdrop-blur-xl"
      style={{ borderColor: colour, background: `color-mix(in srgb, ${colour} 9%, var(--panel))` }}
    >
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: colour }}>
        {LABELS[block.variant]}
      </p>
      {block.title && <p className="mt-1 font-display text-lg font-medium">{block.title}</p>}
      <Markdown className="mt-2">{block.markdown}</Markdown>
    </aside>
  );
}
