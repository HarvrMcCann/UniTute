import type { BlockOf } from "@/lib/course/schema";
import { CheckIcon } from "@/components/ui/icons";
import { Markdown } from "./Markdown";

export function SummaryBlock({ block }: { block: BlockOf<"summary"> }) {
  return (
    <div className="mt-4 rounded-2xl border border-line bg-panel px-5 py-5 frost">
      <p className="font-display text-lg font-medium">In summary</p>
      <ul className="mt-3 space-y-2.5 text-[1.0625rem] leading-relaxed md:text-lg">
        {block.points.map((point, i) => (
          <li key={i} className="flex gap-3">
            <CheckIcon className="mt-1.5 size-4 shrink-0 text-accent" />
            <Markdown inline>{point}</Markdown>
          </li>
        ))}
      </ul>
    </div>
  );
}
