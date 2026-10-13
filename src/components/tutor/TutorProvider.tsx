"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { getTutorHistory } from "@/app/actions";
import { useProgress } from "@/components/classroom/ProgressContext";
import { LESSON_SCROLL_ID } from "@/components/classroom/ProgressTracker";
import { TUTOR_STREAM_END, withQuote, type ChatMessage, type TutorStreamEnd } from "@/lib/tutor/protocol";

/*
 * Tutor chat state. The side panel (tablet/desktop) and bottom sheet (phone) both show it, so it
 * lives above them. Replies stream from /api/tutor.
 */

type TutorContextValue = {
  messages: ChatMessage[];
  /** "idle" until history is first requested. */
  status: "idle" | "loading" | "ready" | "sending";
  error: string | null;
  needsCredit: boolean;
  loadHistory: () => void;
  send: (text: string) => void;
  /** The tutor link being hovered (desktop draws a line from it to the lesson). Chips are found by data-chip-id. */
  activeAnchor: ActiveAnchor | null;
  setActiveAnchor: (anchor: ActiveAnchor | null) => void;
  /** What the next question will be linked to: follows the reader unless pinned (by highlighting text, or clearing it). */
  draft: DraftAnchor;
  setDraft: (draft: DraftAnchor) => void;
  /** The message box has focus (desktop shows the line to the draft anchor). */
  inputFocused: boolean;
  setInputFocused: (focused: boolean) => void;
  /** Opens the tutor and focuses the message box (e.g. after "Ask tutor" on highlighted text). */
  openAndFocus: () => void;
  /** When focus was last requested (ms); panels focus their box if it was just now. */
  focusRequest: number;
};

export type ActiveAnchor = { blockId: string; chipId: string };
export type DraftAnchor = { blockId: string | null; quote: string | null; pinned: boolean };
const FOLLOWING: DraftAnchor = { blockId: null, quote: null, pinned: false };

/** Chip id of the "linked to" preview above the message box. */
export const DRAFT_CHIP_ID = "draft-anchor";

const TutorContext = createContext<TutorContextValue | null>(null);

export const useTutor = () => {
  const value = useContext(TutorContext);
  if (!value) throw new Error("useTutor needs a TutorProvider");
  return value;
};

/** Where "where you're reading" is measured: this far down the lesson's visible area. */
const READING_LINE = 0.35;

/** The part of the lesson at the reading line: what "this" most likely refers to. */
export function blockInView(): string | null {
  const container = document.getElementById(LESSON_SCROLL_ID);
  if (!container) return null;
  const view = container.getBoundingClientRect();
  const line = view.top + view.height * READING_LINE;
  const blocks = [...container.querySelectorAll<HTMLElement>("[data-block-id]")];
  // The part crossing the line, or else the first one below it (the line can fall in a gap).
  const visible = blocks.find((b) => b.getBoundingClientRect().bottom > line);
  return visible?.dataset.blockId ?? blocks.at(-1)?.dataset.blockId ?? null;
}

let localId = 0;

type TutorProviderProps = {
  courseId: string;
  lessonKey: string | undefined;
  /** Opens the tutor panel or sheet (owned by the classroom shell). */
  onOpen: () => void;
  children: React.ReactNode;
};

export function TutorProvider({ courseId, lessonKey, onOpen, children }: TutorProviderProps) {
  const { userId, setCredit } = useProgress();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<TutorContextValue["status"]>("idle");
  const [error, setError] = useState<string | null>(null);
  const [needsCredit, setNeedsCredit] = useState(false);
  const [activeAnchor, setActiveAnchor] = useState<ActiveAnchor | null>(null);
  const [draft, setDraft] = useState<DraftAnchor>(FOLLOWING);
  const [inputFocused, setInputFocused] = useState(false);
  const [focusRequest, setFocusRequest] = useState(0);
  const requested = useRef(false);

  const openAndFocus = useCallback(() => {
    onOpen();
    setFocusRequest(Date.now());
  }, [onOpen]);

  // Follow the reader: the draft anchor is the part at the top of the screen, until pinned.
  // A new lesson starts following again.
  useEffect(() => {
    setDraft(FOLLOWING); // eslint-disable-line react-hooks/set-state-in-effect -- reset when the lesson changes
    const container = document.getElementById(LESSON_SCROLL_ID);
    if (!container || !lessonKey) return;
    let frame = 0;
    const follow = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const blockId = blockInView();
        setDraft((d) => (d.pinned || d.blockId === blockId ? d : { blockId, quote: null, pinned: false }));
      });
    };
    const settle = setTimeout(follow, 400); // after the lesson has rendered and restored its position
    container.addEventListener("scroll", follow, { passive: true });
    return () => {
      clearTimeout(settle);
      cancelAnimationFrame(frame);
      container.removeEventListener("scroll", follow);
    };
  }, [lessonKey]);

  const loadHistory = useCallback(() => {
    if (requested.current || !userId) return;
    requested.current = true;
    setStatus("loading");
    getTutorHistory(courseId)
      .then((history) => setMessages((current) => [...history, ...current]))
      .catch(() => {})
      .finally(() => setStatus((s) => (s === "loading" ? "ready" : s)));
  }, [courseId, userId]);

  const send = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (!message || !lessonKey || status === "sending") return;
      setError(null);
      setStatus("sending");
      const replyId = `local-${++localId}`;
      const anchorBlockId = draft.pinned ? draft.blockId : (draft.blockId ?? blockInView());
      const quote = draft.pinned ? draft.quote : null;
      setDraft(FOLLOWING);
      setMessages((m) => [
        ...m,
        { id: `local-${++localId}`, role: "user", content: withQuote(message, quote), lessonKey, anchorBlockId },
        { id: replyId, role: "assistant", content: "", lessonKey, anchorBlockId: null },
      ]);
      const setReply = (content: string) => setMessages((m) => m.map((x) => (x.id === replyId ? { ...x, content } : x)));
      const dropReply = () => setMessages((m) => m.filter((x) => x.id !== replyId));

      try {
        const response = await fetch("/api/tutor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ courseId, lessonKey, message, anchorBlockId, quote }),
        });
        if (!response.ok || !response.body) {
          const body = (await response.json().catch(() => null)) as { error?: string; needsCredit?: boolean } | null;
          dropReply();
          setNeedsCredit(Boolean(body?.needsCredit));
          if (body?.needsCredit) setCredit(0);
          setError(body?.error ?? "The tutor couldn't answer just now. Try again in a moment.");
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let received = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          received += decoder.decode(value, { stream: true });
          setReply(received.split(TUTOR_STREAM_END)[0]);
        }
        const [reply, trailer = ""] = received.split(TUTOR_STREAM_END);
        const end = JSON.parse(trailer || "{}") as TutorStreamEnd;
        if (typeof end.credit === "number") setCredit(end.credit);
        if (end.error) {
          if (!reply.trim()) dropReply();
          setError(end.error);
        }
      } catch {
        dropReply();
        setError("Couldn't reach the tutor. Check your connection and try again.");
      } finally {
        setStatus("ready");
      }
    },
    [courseId, lessonKey, status, setCredit, draft],
  );

  const value = useMemo(
    () => ({
      messages,
      status,
      error,
      needsCredit,
      loadHistory,
      send,
      activeAnchor,
      setActiveAnchor,
      draft,
      setDraft,
      inputFocused,
      setInputFocused,
      openAndFocus,
      focusRequest,
    }),
    [messages, status, error, needsCredit, loadHistory, send, activeAnchor, draft, inputFocused, openAndFocus, focusRequest],
  );
  return <TutorContext.Provider value={value}>{children}</TutorContext.Provider>;
}
