import type { BlockOf } from "@/lib/course/schema";
import { Markdown } from "./Markdown";
import { StepReveal } from "./StepReveal";

export function WorkedExampleBlock({ block }: { block: BlockOf<"workedExample"> }) {
  return (
    <div className="rounded-2xl border border-line bg-panel px-5 py-5 backdrop-blur-xl">
      <p className="text-xs font-semibold uppercase tracking-wider text-faint">Worked example</p>
      <Markdown className="mt-2">{block.problem}</Markdown>
      <StepReveal
        steps={block.steps.map((step, i) => (
          <Markdown key={i}>{step}</Markdown>
        ))}
        answer={<Markdown>{block.answer}</Markdown>}
      />
    </div>
  );
}
