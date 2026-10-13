"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { LESSON_SCROLL_ID } from "@/components/classroom/ProgressTracker";
import { SparkIcon } from "@/components/ui/icons";
import { useTutor } from "./TutorProvider";

type Selected = { x: number; top: number; bottom: number; blockId: string; text: string };

const MAX_QUOTE = 600;

/** The lesson part a node is inside, if any. */
const blockOf = (node: Node | null) =>
  (node instanceof Element ? node : node?.parentElement)?.closest<HTMLElement>("[data-block-id]") ?? null;

/**
 * Highlight text in the lesson and an "Ask tutor" button appears next to it. The question you
 * then write is linked to that part, with the highlighted text quoted.
 */
export function SelectionAsk() {
  const { setDraft, openAndFocus } = useTutor();
  const [selected, setSelected] = useState<Selected | null>(null);

  useEffect(() => {
    const container = document.getElementById(LESSON_SCROLL_ID);
    if (!container) return;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const read = () => {
      const selection = document.getSelection();
      const text = selection?.toString().replace(/\s+/g, " ").trim() ?? "";
      if (!selection || selection.isCollapsed || !selection.rangeCount || text.length < 2) return setSelected(null);
      const range = selection.getRangeAt(0);
      const block = blockOf(range.startContainer);
      if (!block || !container.contains(block)) return setSelected(null);
      const rect = range.getBoundingClientRect();
      setSelected({ x: rect.left + rect.width / 2, top: rect.top, bottom: rect.bottom, blockId: block.dataset.blockId!, text: text.slice(0, MAX_QUOTE) });
    };
    // Wait for the selection to settle (dragging fires many events).
    const onChange = () => {
      clearTimeout(timer);
      timer = setTimeout(read, 180);
    };
    const hide = () => setSelected(null);

    document.addEventListener("selectionchange", onChange);
    container.addEventListener("scroll", hide, { passive: true });
    window.addEventListener("resize", hide);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("selectionchange", onChange);
      container.removeEventListener("scroll", hide);
      window.removeEventListener("resize", hide);
    };
  }, []);

  // Phones show their own copy/select menu above a selection, so put ours below it.
  const below = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

  return (
    <AnimatePresence>
      {selected && (
        <motion.button
          key="ask"
          type="button"
          initial={{ opacity: 0, y: below ? -4 : 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          // Keep the selection while clicking.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            setDraft({ blockId: selected.blockId, quote: selected.text, pinned: true });
            setSelected(null);
            document.getSelection()?.removeAllRanges();
            openAndFocus();
          }}
          className="fixed z-40 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-sm font-medium text-accent-contrast shadow-lg print:hidden"
          style={{
            left: Math.min(Math.max(selected.x, 70), (typeof window !== "undefined" ? window.innerWidth : 1000) - 70),
            top: below ? selected.bottom + 10 : Math.max(8, selected.top - 44),
          }}
        >
          <SparkIcon className="size-4" /> Ask tutor
        </motion.button>
      )}
    </AnimatePresence>
  );
}
