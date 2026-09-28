"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { seededShuffle } from "@/lib/shuffle";

type Card = { front: React.ReactNode; back: React.ReactNode; lesson: string };

/**
 * One card at a time: tap (or Space) to flip, then "Again" (the card goes back into the
 * deck) or "Got it" (it's done for this round). Phase 6 will feed these into mastery.
 */
export function FlashcardDeck({ cards }: { cards: Card[] }) {
  const reduce = useReducedMotion();
  const [queue, setQueue] = useState(() => cards.map((_, i) => i));
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState(0);

  const current = queue[0];
  const done = queue.length === 0;

  function answer(gotIt: boolean) {
    setFlipped(false);
    setQueue(([head, ...rest]) => (gotIt ? rest : [...rest, head]));
    if (gotIt) setKnown((k) => k + 1);
  }

  function restart(shuffle: boolean) {
    const order = cards.map((_, i) => i);
    setQueue(shuffle ? seededShuffle(order, String(Date.now())) : order);
    setKnown(0);
    setFlipped(false);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (done || (e.target as HTMLElement)?.closest("input, textarea, button, a")) return;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (flipped && e.key === "ArrowRight") answer(true);
      else if (flipped && e.key === "ArrowLeft") answer(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (done) {
    return (
      <div className="rounded-2xl border border-line bg-panel p-8 text-center frost">
        <p className="font-display text-2xl">Deck done</p>
        <p className="mt-2 text-muted">You went through all {cards.length} cards.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button type="button" onClick={() => restart(false)} className="rounded-xl bg-accent px-5 py-2.5 font-medium text-accent-contrast">
            Go again
          </button>
          <button type="button" onClick={() => restart(true)} className="rounded-xl border border-line px-5 py-2.5 hover:bg-hover">
            Shuffle and go again
          </button>
        </div>
      </div>
    );
  }

  const card = cards[current];
  return (
    <div>
      <div className="mb-3 flex items-center justify-between text-sm text-muted">
        <span>
          {known} of {cards.length} known · {queue.length} left
        </span>
        <button type="button" onClick={() => restart(true)} className="rounded-lg px-2 py-1 hover:bg-hover hover:text-text">
          Shuffle
        </button>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-hover">
        <div className="h-full rounded-full bg-progress transition-[width] duration-300" style={{ width: `${(known / cards.length) * 100}%` }} />
      </div>

      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        aria-label={flipped ? "Show the front" : "Show the answer"}
        className="mt-4 block w-full text-left active:transform-none"
        style={{ perspective: 1200 }}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${current}-${flipped}`}
            initial={reduce ? { opacity: 0 } : { rotateY: flipped ? -90 : 90, opacity: 0.6 }}
            animate={reduce ? { opacity: 1 } : { rotateY: 0, opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { rotateY: flipped ? 90 : -90, opacity: 0.6 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className={`flex min-h-64 flex-col justify-center rounded-2xl border p-6 frost sm:p-8 ${
              flipped ? "border-accent/50 bg-accent-soft" : "border-line bg-panel"
            }`}
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-faint">{flipped ? "Answer" : card.lesson}</p>
            <div className="mt-3 text-lg">{flipped ? card.back : card.front}</div>
            {!flipped && <p className="mt-6 text-sm text-faint">Tap to flip</p>}
          </motion.div>
        </AnimatePresence>
      </button>

      <div className={`mt-4 grid grid-cols-2 gap-3 transition-opacity ${flipped ? "opacity-100" : "pointer-events-none opacity-0"}`}>
        <button type="button" onClick={() => answer(false)} className="rounded-xl border border-line py-3 font-medium hover:bg-hover">
          Again
        </button>
        <button type="button" onClick={() => answer(true)} className="rounded-xl bg-accent py-3 font-medium text-accent-contrast">
          Got it
        </button>
      </div>
    </div>
  );
}
