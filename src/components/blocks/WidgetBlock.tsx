import type { BlockOf } from "@/lib/course/schema";
import { SparkIcon } from "@/components/ui/icons";
import { Markdown } from "./Markdown";
import { WidgetFrame } from "./WidgetFrame";
import type { WidgetFixTarget } from "./WidgetFixForm";

/** An interactive Claude designed for this lesson (simulation, builder, explorable). */
export function WidgetBlock({ block, fix }: { block: BlockOf<"widget">; fix?: WidgetFixTarget }) {
  return (
    <figure className="rounded-2xl border border-line bg-panel p-4 frost sm:p-5">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent">
        <SparkIcon className="size-3.5" /> Interactive
      </p>
      <p className="mt-1 font-display text-lg">{block.title}</p>
      <div className="mt-3">
        <WidgetFrame
          title={block.title}
          html={block.html}
          initialHeight={block.height}
          fix={fix}
          fallback={
            <div className="rounded-xl bg-accent-soft px-4 py-3">
              <p className="text-sm text-muted">This interactive couldn&rsquo;t start, so here&rsquo;s what it shows:</p>
              <Markdown className="mt-2">{block.description}</Markdown>
            </div>
          }
        />
      </div>
    </figure>
  );
}
