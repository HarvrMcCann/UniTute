"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";

type StepRevealProps = {
  steps: React.ReactNode[];
  answer: React.ReactNode;
};

/** Reveals a worked example one step at a time so the learner can try each step first. */
export function StepReveal({ steps, answer }: StepRevealProps) {
  const [shown, setShown] = useState(0);
  const done = shown > steps.length; // steps + answer

  return (
    <div className="mt-4">
      <ol className="space-y-3">
        <AnimatePresence initial={false}>
          {steps.slice(0, shown).map((step, i) => (
            <motion.li
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="flex gap-3"
            >
              <span className="mt-1 grid size-6 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">{step}</div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>

      {done && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="mt-4 rounded-xl bg-accent-soft px-4 py-3"
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-accent">Answer</p>
          <div className="mt-1">{answer}</div>
        </motion.div>
      )}

      {!done && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShown((n) => n + 1)}
            className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-contrast transition-opacity hover:opacity-90"
          >
            {shown === 0 ? "Show first step" : shown < steps.length ? "Next step" : "Show answer"}
          </button>
          <button
            type="button"
            onClick={() => setShown(steps.length + 1)}
            className="rounded-xl px-4 py-2 text-sm text-muted transition-colors hover:bg-hover hover:text-text"
          >
            Show all
          </button>
        </div>
      )}
    </div>
  );
}
