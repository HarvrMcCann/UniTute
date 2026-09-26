import type { BlockOf } from "@/lib/course/schema";
import { Markdown } from "./Markdown";

export function DefinitionBlock({ block }: { block: BlockOf<"definition"> }) {
  return (
    <div className="rounded-2xl border border-line bg-panel px-5 py-4 frost">
      <p className="text-xs font-semibold uppercase tracking-wider text-faint">Definition</p>
      <p className="mt-1 font-display text-lg font-medium text-accent">{block.term}</p>
      <Markdown className="mt-2">{block.markdown}</Markdown>
    </div>
  );
}
