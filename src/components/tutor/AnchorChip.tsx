"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useReducedMotion } from "motion/react";
import { useTutor } from "./TutorProvider";

const HIGHLIGHT = "tutor-highlight";

/** Briefly rings a lesson block after jumping to it. */
export function flashBlock(el: HTMLElement) {
  el.classList.add(HIGHLIGHT);
  setTimeout(() => el.classList.remove(HIGHLIGHT), 1800);
}

type AnchorChipProps = {
  courseId: string;
  blockId: string;
  /** The lesson the message was written in. */
  lessonKey: string | null;
  /** Shown before the label, e.g. "About". */
  prefix?: string;
};

/**
 * A link from the chat to part of the lesson. Click to scroll there; on desktop, hovering draws a
 * line to it. Parts of other lessons become ordinary links.
 */
export function AnchorChip({ courseId, blockId, lessonKey, prefix }: AnchorChipProps) {
  const { lessonId } = useParams<{ lessonId?: string }>();
  const { setActiveAnchor } = useTutor();
  const reduceMotion = useReducedMotion();
  // Chips only render in the browser (chat messages load client-side), so the DOM is available.
  const target = lessonKey === lessonId || !lessonKey ? document.getElementById(blockId) : null;
  const label = target?.dataset.blockLabel;
  const chip = "mx-0.5 inline-flex max-w-full items-center gap-1 rounded-full border border-accent/40 bg-accent-soft px-2 py-0.5 align-baseline text-xs font-medium text-accent transition-colors hover:border-accent";

  if (!target) {
    if (!lessonKey) return null;
    return (
      <Link href={`/course/${courseId}/${lessonKey}`} className={chip}>
        {prefix ? `${prefix} ` : ""}another lesson ↗
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={chip}
      onClick={() => {
        target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
        flashBlock(target);
      }}
      onMouseEnter={(e) => setActiveAnchor({ blockId, chip: e.currentTarget })}
      onMouseLeave={() => setActiveAnchor(null)}
      onFocus={(e) => setActiveAnchor({ blockId, chip: e.currentTarget })}
      onBlur={() => setActiveAnchor(null)}
    >
      <span aria-hidden>↗</span>
      <span className="truncate">
        {prefix ? `${prefix} ` : ""}
        {label ?? "this part"}
      </span>
    </button>
  );
}
