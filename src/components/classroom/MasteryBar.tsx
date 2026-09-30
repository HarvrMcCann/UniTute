import { levelOf } from "@/lib/mastery";

const COLOUR = { unseen: "var(--text-faint)", low: "var(--mastery-low)", mid: "var(--mastery-mid)", high: "var(--mastery-high)" };
const LABEL = { unseen: "Not tested", low: "Getting started", mid: "Getting there", high: "Strong" };

/** A thin bar showing a knowledge level (0-1), coloured low / mid / high. */
export function MasteryBar({ score, className = "" }: { score: number; className?: string }) {
  const level = levelOf(score);
  return (
    <span
      role="img"
      aria-label={`Knowledge level ${Math.round(score * 100)}%: ${LABEL[level]}`}
      title={`${Math.round(score * 100)}% · ${LABEL[level]}`}
      className={`block h-1 overflow-hidden rounded-full bg-hover ${className}`}
    >
      <span
        className="block h-full rounded-full transition-[width] duration-500"
        style={{ width: `${Math.max(4, score * 100)}%`, background: COLOUR[level] }}
      />
    </span>
  );
}

export { LABEL as MASTERY_LABEL };
