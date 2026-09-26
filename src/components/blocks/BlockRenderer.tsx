import type { Block, Question } from "@/lib/course/schema";
import { CalloutBlock } from "./CalloutBlock";
import { CheckBlock } from "./CheckBlock";
import { CodeBlock } from "./CodeBlock";
import { DefinitionBlock } from "./DefinitionBlock";
import { Markdown } from "./Markdown";
import { MathBlock } from "./MathBlock";
import { SummaryBlock } from "./SummaryBlock";
import { WorkedExampleBlock } from "./WorkedExampleBlock";

type BlockRendererProps = {
  block: Block;
  questions: Map<string, Question>;
  /** Question key -> database UUID, for recording attempts. */
  questionIds: Map<string, string>;
};

/** Wraps each block in an anchor (its stable id) so tutor links, progress and bug reports can point at it. */
export function BlockRenderer({ block, questions, questionIds }: BlockRendererProps) {
  return (
    <section id={block.id} data-block-id={block.id} className="scroll-mt-24">
      <BlockContent block={block} questions={questions} questionIds={questionIds} />
    </section>
  );
}

function BlockContent({ block, questions, questionIds }: BlockRendererProps) {
  switch (block.type) {
    case "text":
      return <Markdown>{block.markdown}</Markdown>;
    case "heading":
      return <h2 className="pt-6 font-display text-2xl font-medium tracking-tight sm:text-[1.7rem]">{block.text}</h2>;
    case "callout":
      return <CalloutBlock block={block} />;
    case "definition":
      return <DefinitionBlock block={block} />;
    case "workedExample":
      return <WorkedExampleBlock block={block} />;
    case "code":
      return <CodeBlock block={block} />;
    case "math":
      return <MathBlock block={block} />;
    case "summary":
      return <SummaryBlock block={block} />;
    case "check": {
      const question = questions.get(block.questionId);
      return question ? <CheckBlock question={question} questionDbId={questionIds.get(question.id)!} /> : null;
    }
  }
}
