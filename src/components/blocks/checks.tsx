"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useRef, useState } from "react";
import { markAnswer, recordAnswer } from "@/app/actions";
import { useProgress } from "@/components/classroom/ProgressContext";
import { formatCredit, MIN_CREDIT_USD } from "@/lib/credits";
import { orderingScore, type MasteryState } from "@/lib/mastery";
import { CheckIcon, CloseIcon, DownIcon, UpIcon } from "@/components/ui/icons";

// ---------- Recording ----------

type QuestionIds = { questionKey: string; questionDbId: string; conceptKey: string };

/**
 * finish(score): call once when a check is finished (solved, answer revealed or marked). Saves the
 * answer when signed in, then updates the sidebar's progress and mastery. Score is 0-1: the first
 * try for multiple choice, partial credit for ordering, the mark for short answer.
 * saved(mastery): the same, for answers already saved on the server (AI marking).
 */
function useFinish({ questionKey, questionDbId, conceptKey }: QuestionIds) {
  const { userId, markAnswered, setMastery } = useProgress();
  const done = useRef(false);
  const claim = useCallback(() => {
    if (done.current) return false;
    done.current = true;
    markAnswered(questionKey);
    return true;
  }, [markAnswered, questionKey]);

  const finish = useCallback(
    (score: number, markedBy: "auto" | "self" = "auto", response?: string) => {
      if (!claim() || !userId) return;
      recordAnswer({ questionDbId, score, markedBy, response })
        .then((mastery) => mastery && setMastery(conceptKey, mastery))
        .catch(() => {});
    },
    [claim, userId, questionDbId, conceptKey, setMastery],
  );
  const saved = useCallback(
    (mastery: MasteryState | null) => {
      if (claim() && mastery) setMastery(conceptKey, mastery);
    },
    [claim, conceptKey, setMastery],
  );
  return { finish, saved };
}

// ---------- Shared pieces ----------

function PrimaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-contrast transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
    />
  );
}

function GhostButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className="rounded-xl px-4 py-2 text-sm text-muted transition-colors hover:bg-hover hover:text-text"
    />
  );
}

/** A small burst of dots for correct answers. Skipped entirely under reduced motion. */
function Celebration() {
  const reduce = useReducedMotion();
  if (reduce) return null;
  const colours = ["var(--accent)", "var(--callout-tip)", "var(--callout-example)", "var(--mastery-high)"];
  return (
    <span aria-hidden className="pointer-events-none absolute left-4 top-1/2">
      {Array.from({ length: 12 }, (_, i) => {
        const angle = (i / 12) * Math.PI * 2;
        const distance = 34 + (i % 3) * 10;
        return (
          <motion.span
            key={i}
            className="absolute size-1.5 rounded-full"
            style={{ background: colours[i % colours.length] }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{ x: Math.cos(angle) * distance, y: Math.sin(angle) * distance, opacity: 0, scale: 0.4 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        );
      })}
    </span>
  );
}

type FeedbackProps = {
  correct: boolean;
  /** Amber styling for partly-right answers. */
  partial?: boolean;
  title: string;
  children?: React.ReactNode;
};

function Feedback({ correct, partial = false, title, children }: FeedbackProps) {
  const colour = correct ? "var(--mastery-high)" : partial ? "var(--mastery-mid)" : "var(--mastery-low)";
  return (
    <motion.div
      role="status"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="relative mt-4 rounded-xl px-4 py-3"
      style={{ background: `color-mix(in srgb, ${colour} 12%, transparent)` }}
    >
      {correct && <Celebration />}
      <p className="flex items-center gap-2 font-medium" style={{ color: colour }}>
        {correct ? <CheckIcon className="size-4" /> : <CloseIcon className="size-4" />}
        {title}
      </p>
      {children && <div className="mt-2">{children}</div>}
    </motion.div>
  );
}

// ---------- Multiple choice ----------

type MultipleChoiceProps = QuestionIds & {
  options: React.ReactNode[];
  answerIndex: number;
  explanation: React.ReactNode;
};

export function MultipleChoiceCheck({ options, answerIndex, explanation, ...ids }: MultipleChoiceProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [mistakes, setMistakes] = useState(0);
  const { finish } = useFinish(ids);

  const correct = checked && selected === answerIndex;
  const locked = checked;

  function check() {
    setChecked(true);
    if (selected === answerIndex) {
      setRevealed(true);
      finish(mistakes === 0 ? 1 : 0);
    } else {
      setMistakes((m) => m + 1);
    }
  }

  function reveal() {
    setRevealed(true);
    finish(0);
  }

  function retry() {
    setChecked(false);
    setSelected(null);
  }

  return (
    <div>
      <div role="radiogroup" className="space-y-2">
        {options.map((option, i) => {
          const isSelected = selected === i;
          const showCorrect = revealed && i === answerIndex;
          const showWrong = checked && isSelected && i !== answerIndex;
          return (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={locked}
              onClick={() => setSelected(i)}
              className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors disabled:cursor-default ${
                showCorrect
                  ? "border-mastery-high bg-mastery-high/10"
                  : showWrong
                    ? "border-mastery-low bg-mastery-low/10"
                    : isSelected
                      ? "border-accent bg-accent-soft"
                      : "border-line hover:border-accent/40 hover:bg-hover"
              }`}
            >
              <span
                className={`grid size-5 shrink-0 place-items-center rounded-full border ${
                  isSelected ? "border-accent" : "border-faint"
                }`}
              >
                {isSelected && <span className="size-2.5 rounded-full bg-accent" />}
              </span>
              <span className="min-w-0 flex-1">{option}</span>
            </button>
          );
        })}
      </div>

      {!checked && (
        <div className="mt-4">
          <PrimaryButton disabled={selected === null} onClick={check}>
            Check
          </PrimaryButton>
        </div>
      )}

      {checked && !revealed && (
        <Feedback correct={false} title="Not quite. Have another go?">
          <div className="flex flex-wrap gap-2">
            <PrimaryButton onClick={retry}>Try again</PrimaryButton>
            <GhostButton onClick={reveal}>Show answer</GhostButton>
          </div>
        </Feedback>
      )}

      {revealed && (
        <Feedback correct={correct} title={correct ? "Correct!" : "Here's the answer"}>
          {explanation}
        </Feedback>
      )}
    </div>
  );
}

// ---------- Short answer ----------

type ShortAnswerProps = QuestionIds & {
  modelAnswer: React.ReactNode;
  explanation: React.ReactNode;
};

const VERDICT_TITLE = { correct: "Correct!", partial: "Partly there", incorrect: "Not quite" } as const;
const SELF_MARKS = [
  { score: 1, label: "Got it" },
  { score: 0.5, label: "Partly" },
  { score: 0, label: "Not yet" },
] as const;

/**
 * Free: compare with the model answer and mark yourself (got it / partly / not yet).
 * With credit: Claude Haiku marks it against the marking guide and says what's missing.
 */
export function ShortAnswerCheck({ modelAnswer, explanation, ...ids }: ShortAnswerProps) {
  const { finish, saved } = useFinish(ids);
  const { userId, credit, setCredit } = useProgress();
  const [answer, setAnswer] = useState("");
  // writing -> (marking -> ai) or self
  const [phase, setPhase] = useState<"writing" | "marking" | "ai" | "self">("writing");
  const [ai, setAi] = useState<{ verdict: keyof typeof VERDICT_TITLE; feedback: string } | null>(null);
  const [selfMark, setSelfMark] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const canAiMark = userId !== null && credit >= MIN_CREDIT_USD;
  const written = answer.trim().length > 0;

  async function markWithAi() {
    setPhase("marking");
    setNotice(null);
    try {
      const result = await markAnswer({ questionDbId: ids.questionDbId, response: answer });
      if (result.ok) {
        setAi({ verdict: result.verdict, feedback: result.feedback });
        setCredit(result.credit);
        saved(result.mastery);
        setPhase("ai");
        return;
      }
      if (result.needsCredit) setCredit(0);
      setNotice(result.reason);
    } catch {
      setNotice("The marker isn't available right now, so mark this one yourself.");
    }
    setPhase("self");
  }

  function compare() {
    setPhase("self");
    // Nothing written: nothing to self-mark.
    if (!written) {
      setSelfMark(0);
      finish(0, "self");
    }
  }

  function mark(score: number) {
    setSelfMark(score);
    finish(score, "self", answer);
  }

  const reveal = (
    <>
      <div className="rounded-xl bg-accent-soft px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-accent">Model answer</p>
        <div className="mt-1">{modelAnswer}</div>
      </div>
      <div className="px-1">{explanation}</div>
    </>
  );

  return (
    <div>
      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        readOnly={phase !== "writing"}
        rows={3}
        maxLength={2000}
        aria-label="Your answer"
        placeholder="Type your answer…"
        className="w-full resize-y rounded-xl border border-line bg-code px-4 py-3 text-base outline-none transition-colors placeholder:text-faint focus:border-accent"
      />

      {(phase === "writing" || phase === "marking") && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {canAiMark ? (
            <>
              <PrimaryButton disabled={!written || phase === "marking"} onClick={markWithAi}>
                {phase === "marking" ? "Marking…" : "Mark my answer"}
              </PrimaryButton>
              <GhostButton disabled={phase === "marking"} onClick={compare}>
                {written ? "Mark it myself" : "I’m not sure, show me"}
              </GhostButton>
              <span className="text-xs text-faint">AI marking uses a fraction of a cent · {formatCredit(credit)} left</span>
            </>
          ) : (
            <>
              <PrimaryButton disabled={!written} onClick={compare}>
                Compare with model answer
              </PrimaryButton>
              <GhostButton onClick={compare}>I&rsquo;m not sure, show me</GhostButton>
            </>
          )}
        </div>
      )}

      {phase === "ai" && ai && (
        <div className="space-y-3">
          <Feedback correct={ai.verdict === "correct"} partial={ai.verdict === "partial"} title={VERDICT_TITLE[ai.verdict]}>
            <p className="text-[0.95rem]">{ai.feedback}</p>
            <p className="mt-2 text-xs text-faint">Marked by AI · {formatCredit(credit)} credit left</p>
          </Feedback>
          {reveal}
        </div>
      )}

      {phase === "self" && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="mt-4 space-y-3"
        >
          {notice && <p className="px-1 text-sm text-muted">{notice}</p>}
          {reveal}

          {selfMark === null ? (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-sm text-muted">How did you go?</span>
              {SELF_MARKS.map((m, i) =>
                i === 0 ? (
                  <PrimaryButton key={m.label} onClick={() => mark(m.score)}>
                    {m.label}
                  </PrimaryButton>
                ) : (
                  <GhostButton key={m.label} onClick={() => mark(m.score)}>
                    {m.label}
                  </GhostButton>
                ),
              )}
            </div>
          ) : selfMark === 1 ? (
            <Feedback correct title="Nice work!" />
          ) : (
            <p className="px-1 text-sm text-muted">
              {selfMark === 0.5
                ? "Good start. Check what the model answer has that yours didn't."
                : "No worries. Re-read the section above, then try explaining it in your own words."}
            </p>
          )}
        </motion.div>
      )}
    </div>
  );
}

// ---------- Ordering ----------

type OrderingProps = QuestionIds & {
  items: React.ReactNode[];
  /** Shuffled indices into `items`; the correct order is 0, 1, 2… */
  initialOrder: number[];
  explanation: React.ReactNode;
};

export function OrderingCheck({ items, initialOrder, explanation, ...ids }: OrderingProps) {
  const [order, setOrder] = useState(initialOrder);
  const [checked, setChecked] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const { finish } = useFinish(ids);
  // Partial credit comes from the first check; later tries only help you get there.
  const firstScore = useRef<number | null>(null);

  const inPlace = order.filter((item, position) => item === position).length;
  const allCorrect = inPlace === order.length;

  function move(position: number, delta: -1 | 1) {
    const target = position + delta;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[position], next[target]] = [next[target], next[position]];
    setOrder(next);
    setChecked(false);
  }

  function check() {
    setChecked(true);
    firstScore.current ??= orderingScore(order);
    if (allCorrect) {
      setRevealed(true);
      finish(firstScore.current);
    }
  }

  function showAnswer() {
    setOrder(order.map((_, i) => i));
    setChecked(false); // revealed, not earned
    setRevealed(true);
    finish(firstScore.current ?? 0);
  }

  return (
    <div>
      <ol className="space-y-2">
        {order.map((item, position) => {
          const mark = checked ? (item === position ? "right" : "wrong") : null;
          return (
            <motion.li
              key={item}
              layout
              transition={{ type: "spring", stiffness: 500, damping: 40 }}
              className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${
                mark === "right"
                  ? "border-mastery-high bg-mastery-high/10"
                  : mark === "wrong"
                    ? "border-mastery-low bg-mastery-low/10"
                    : "border-line bg-panel"
              }`}
            >
              <span className="w-5 shrink-0 text-center text-sm font-semibold text-faint">{position + 1}</span>
              <span className="min-w-0 flex-1 py-1">{items[item]}</span>
              {!revealed && (
                <span className="flex shrink-0 flex-col sm:flex-row">
                  <button
                    type="button"
                    aria-label="Move up"
                    disabled={position === 0}
                    onClick={() => move(position, -1)}
                    className="grid size-8 place-items-center rounded-lg text-muted transition-colors hover:bg-hover hover:text-text disabled:opacity-25"
                  >
                    <UpIcon className="size-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Move down"
                    disabled={position === order.length - 1}
                    onClick={() => move(position, 1)}
                    className="grid size-8 place-items-center rounded-lg text-muted transition-colors hover:bg-hover hover:text-text disabled:opacity-25"
                  >
                    <DownIcon className="size-4" />
                  </button>
                </span>
              )}
            </motion.li>
          );
        })}
      </ol>

      <AnimatePresence mode="wait">
        {!revealed && !checked && (
          <motion.div key="check" className="mt-4" exit={{ opacity: 0 }}>
            <PrimaryButton onClick={check}>Check order</PrimaryButton>
          </motion.div>
        )}
      </AnimatePresence>

      {checked && !revealed && (
        <Feedback correct={false} title={`${inPlace} of ${order.length} in the right place`}>
          <div className="flex flex-wrap gap-2">
            <PrimaryButton onClick={() => setChecked(false)}>Keep trying</PrimaryButton>
            <GhostButton onClick={showAnswer}>Show answer</GhostButton>
          </div>
        </Feedback>
      )}

      {revealed && (
        <Feedback correct={checked && allCorrect} title={checked && allCorrect ? "Correct!" : "Here's the right order"}>
          {explanation}
        </Feedback>
      )}
    </div>
  );
}
