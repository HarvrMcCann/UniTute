"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { saveProgress, type ProgressUpdate } from "@/app/actions";
import { useProgress } from "./ProgressContext";

export const LESSON_SCROLL_ID = "lesson-scroll";
export const LESSON_END_ID = "lesson-end";
const SAVE_DELAY_MS = 1500;

type ProgressTrackerProps = {
  courseId: string;
  lessonKey: string;
  lessonDbId: string;
  /** Block to scroll back to, or null to start at the top. */
  resumeBlockId: string | null;
};

/**
 * Remembers where the learner is in a lesson: the top-most block on screen (saved a
 * moment after scrolling stops) and completion when the end of the lesson comes into view.
 * Also restores the scroll position when a lesson opens.
 */
export function ProgressTracker({ courseId, lessonKey, lessonDbId, resumeBlockId }: ProgressTrackerProps) {
  const { userId, markCompleted } = useProgress();
  const [showResumed, setShowResumed] = useState(resumeBlockId !== null);
  const pending = useRef<string | null>(null);

  // Restore position (or start at the top) when the lesson opens.
  useEffect(() => {
    const container = document.getElementById(LESSON_SCROLL_ID);
    const target = resumeBlockId ? document.getElementById(resumeBlockId) : null;
    if (target) target.scrollIntoView({ block: "start" });
    else container?.scrollTo({ top: 0 });
    const timer = setTimeout(() => setShowResumed(false), 6000);
    return () => clearTimeout(timer);
  }, [lessonKey, resumeBlockId]);

  // Track position and completion.
  useEffect(() => {
    if (!userId) return;
    const container = document.getElementById(LESSON_SCROLL_ID);
    if (!container) return;

    const save = (fields: Omit<ProgressUpdate, "courseId" | "lessonDbId">) =>
      saveProgress({ courseId, lessonDbId, ...fields }).catch(() => {
        // offline or navigating away: the next save catches up
      });

    // Opening a lesson counts as a visit, so it becomes the "continue" lesson.
    void save(resumeBlockId ? { lastBlockId: resumeBlockId } : {});

    let timer: ReturnType<typeof setTimeout> | undefined;
    const flush = () => {
      clearTimeout(timer);
      if (pending.current) {
        void save({ lastBlockId: pending.current });
        pending.current = null;
      }
    };

    const visible = new Set<Element>();
    const blocks = [...container.querySelectorAll("[data-block-id]")];
    const blockObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target);
          else visible.delete(entry.target);
        }
        const top = blocks.find((b) => visible.has(b)) as HTMLElement | undefined;
        if (!top?.dataset.blockId) return;
        pending.current = top.dataset.blockId;
        clearTimeout(timer);
        timer = setTimeout(flush, SAVE_DELAY_MS);
      },
      // Only the upper part of the screen counts as "where you are".
      { root: container, rootMargin: "0px 0px -55% 0px" },
    );
    blocks.forEach((b) => blockObserver.observe(b));

    let completed = false;
    const endObserver = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || completed) return;
        completed = true;
        markCompleted(lessonKey);
        void save({ completed: true });
      },
      { root: container },
    );
    const end = document.getElementById(LESSON_END_ID);
    if (end) endObserver.observe(end);

    const onHide = () => document.visibilityState === "hidden" && flush();
    document.addEventListener("visibilitychange", onHide);

    return () => {
      flush();
      blockObserver.disconnect();
      endObserver.disconnect();
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [userId, courseId, lessonKey, lessonDbId, resumeBlockId, markCompleted]);

  return (
    <AnimatePresence>
      {showResumed && (
        <motion.div
          role="status"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          className="fixed inset-x-0 bottom-5 z-30 flex justify-center px-4"
        >
          <div className="flex items-center gap-3 rounded-full border border-line bg-panel-strong py-1.5 pl-4 pr-1.5 text-sm shadow-lg frost">
            <span className="text-muted">Picked up where you left off</span>
            <button
              type="button"
              onClick={() => {
                document.getElementById(LESSON_SCROLL_ID)?.scrollTo({ top: 0, behavior: "smooth" });
                setShowResumed(false);
              }}
              className="rounded-full px-3 py-1 text-accent transition-colors hover:bg-hover"
            >
              Back to top
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
