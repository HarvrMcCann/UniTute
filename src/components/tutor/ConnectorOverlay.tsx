"use client";

import { useEffect, useState } from "react";
import { LESSON_SCROLL_ID } from "@/components/classroom/ProgressTracker";
import { useTutor } from "./TutorProvider";

const DESKTOP = "(min-width: 1024px)";
type Line = { x1: number; y1: number; x2: number; y2: number; offscreen: boolean };

/**
 * Desktop: while a tutor link is hovered, a curved line runs from it to the lesson part it means,
 * and that part is ringed. If the part is scrolled out of view, the line points to the lesson's edge.
 */
export function ConnectorOverlay() {
  const { activeAnchor } = useTutor();
  const [line, setLine] = useState<Line | null>(null);

  useEffect(() => {
    if (!activeAnchor || !window.matchMedia(DESKTOP).matches) return;
    const block = document.getElementById(activeAnchor.blockId);
    const container = document.getElementById(LESSON_SCROLL_ID);
    if (!block || !container) return;

    block.classList.add("tutor-highlight");
    let frame = 0;
    const measure = () => {
      const chip = activeAnchor.chip.getBoundingClientRect();
      const b = block.getBoundingClientRect();
      const view = container.getBoundingClientRect();
      const midY = (b.top + b.bottom) / 2;
      const y2 = Math.min(view.bottom - 12, Math.max(view.top + 12, midY));
      setLine({
        x1: chip.left - 4,
        y1: chip.top + chip.height / 2,
        x2: Math.min(b.right, view.right) + 6,
        y2,
        offscreen: y2 !== midY && (b.bottom < view.top || b.top > view.bottom),
      });
      frame = requestAnimationFrame(measure);
    };
    measure();
    return () => {
      cancelAnimationFrame(frame);
      block.classList.remove("tutor-highlight");
      setLine(null);
    };
  }, [activeAnchor]);

  if (!line) return null;
  const bend = Math.max(40, (line.x1 - line.x2) / 2);
  return (
    <svg aria-hidden className="pointer-events-none fixed inset-0 z-30 h-full w-full print:hidden">
      <path
        d={`M ${line.x1} ${line.y1} C ${line.x1 - bend} ${line.y1}, ${line.x2 + bend} ${line.y2}, ${line.x2} ${line.y2}`}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="1.75"
        strokeDasharray={line.offscreen ? "5 5" : undefined}
        opacity="0.85"
      />
      <circle cx={line.x1} cy={line.y1} r="3" fill="var(--accent)" />
      <circle cx={line.x2} cy={line.y2} r="4" fill="var(--accent)" />
    </svg>
  );
}
