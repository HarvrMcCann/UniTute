"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useRef, useState } from "react";
import { recordAttempt } from "@/app/actions";
import { useProgress } from "@/components/classroom/ProgressContext";
import { CheckIcon, CloseIcon, DownIcon, UpIcon } from "@/components/ui/icons";

// ---------- Recording ----------

type QuestionIds = { questionKey: string; questionDbId: string };

/**
 * Returns finish(correct): call once when a check is finished (solved, answer revealed or
 * self-marked). Saves an attempt when signed in and updates the sidebar straight away.
 * `correct` = right on the first try. Phase 6 builds mastery on these attempts.
 */
function useFinish({ questionKey, questionDbId }: QuestionIds) {
  const { userId, markAnswered } = useProgress();
  const done = useRef(false);
  return useCallback(
    (correct: boolean) => {
      if (done.current) return;
      done.current = true;
      markAnswered(questionKey);
      if (userId) void recordAttempt(questionDbId, correct).catch(() => {});
    },
    [userId, markAnswered, questionKey, questionDbId],
  );
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
  title: string;
  children?: React.ReactNode;
};

function Feedback({ correct, title, children }: FeedbackProps) {
  const colour = correct ? "var(--mastery-high)" : "var(--mastery-low)";
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
  const finish = useFinish(ids);

  const correct = checked && selected === answerIndex;
  const locked = checked;

  function check() {
    setChecked(true);
    if (selected === answerIndex) {
      setRevealed(true);
      finish(mistakes === 0);
    } else {
      setMistakes((m) => m + 1);
    }
  }

  function reveal() {
    setRevealed(true);
    finish(false);
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

export function ShortAnswerCheck({ modelAnswer, explanation, ...ids }: ShortAnswerProps) {
  const finish = useFinish(ids);
  const [answer, setAnswer] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [selfMark, setSelfMark] = useState<"got" | "notYet" | null>(null);

  return (
    <div>
      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        readOnly={revealed}
        rows={3}
        aria-label="Your answer"
        placeholder="Type your answer…"
        className="w-full resize-y rounded-xl border border-line bg-code px-4 py-3 text-base outline-none transition-colors placeholder:text-faint focus:border-accent"
      />

      {!revealed ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <PrimaryButton disabled={!answer.trim()} onClick={() => setRevealed(true)}>
            Compare with model answer
          </PrimaryButton>
          <GhostButton onClick={() => setRevealed(true)}>I&rsquo;m not sure, show me</GhostButton>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="mt-4 space-y-3"
        >
          <div className="rounded-xl bg-accent-soft px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-accent">Model answer</p>
            <div className="mt-1">{modelAnswer}</div>
          </div>
          <div className="px-1">{explanation}</div>

          {selfMark === null ? (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-sm text-muted">How did you go?</span>
              <PrimaryButton
                onClick={() => {
                  setSelfMark("got");
                  finish(true);
                }}
              >
                I got it
              </PrimaryButton>
              <GhostButton
                onClick={() => {
                  setSelfMark("notYet");
                  finish(false);
                }}
              >
                Not yet
              </GhostButton>
            </div>
          ) : selfMark === "got" ? (
            <Feedback correct title="Nice work!" />
          ) : (
            <p className="px-1 text-sm text-muted">
              No worries. Re-read the section above, then try explaining it in your own words.
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
  const [mistakes, setMistakes] = useState(0);
  const finish = useFinish(ids);

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
    if (allCorrect) {
      setRevealed(true);
      finish(mistakes === 0);
    } else {
      setMistakes((m) => m + 1);
    }
  }

  function showAnswer() {
    setOrder(order.map((_, i) => i));
    setChecked(false); // revealed, not earned
    setRevealed(true);
    finish(false);
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
