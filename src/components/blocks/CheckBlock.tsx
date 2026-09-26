import type { Question } from "@/lib/course/schema";
import { seededShuffle } from "@/lib/shuffle";
import { Markdown } from "./Markdown";
import { MultipleChoiceCheck, OrderingCheck, ShortAnswerCheck } from "./checks";

const TYPE_LABELS: Record<Question["type"], string> = {
  multipleChoice: "Choose one",
  shortAnswer: "Short answer",
  ordering: "Put in order",
};

/** Server part of a knowledge check: renders all markdown, then hands the nodes to a client component. */
export function CheckBlock({ question }: { question: Question }) {
  const explanation = <Markdown>{question.explanation}</Markdown>;

  return (
    <div className="rounded-2xl border border-line bg-panel p-5 frost sm:p-6">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent">
        <span className="size-1.5 rounded-full bg-accent" aria-hidden />
        Check your understanding · {TYPE_LABELS[question.type]}
      </p>
      <Markdown className="mt-3 font-medium">{question.prompt}</Markdown>

      <div className="mt-4">
        {question.type === "multipleChoice" && (
          <MultipleChoiceCheck
            options={question.options.map((o, i) => (
              <Markdown key={i} inline>
                {o}
              </Markdown>
            ))}
            answerIndex={question.answerIndex}
            explanation={explanation}
          />
        )}
        {question.type === "shortAnswer" && (
          <ShortAnswerCheck modelAnswer={<Markdown>{question.modelAnswer}</Markdown>} explanation={explanation} />
        )}
        {question.type === "ordering" && (
          <OrderingCheck
            items={question.items.map((item, i) => (
              <Markdown key={i} inline>
                {item}
              </Markdown>
            ))}
            initialOrder={seededShuffle(
              question.items.map((_, i) => i),
              question.id,
            )}
            explanation={explanation}
          />
        )}
      </div>
    </div>
  );
}
