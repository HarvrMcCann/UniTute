"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { getTutorHistory } from "@/app/actions";
import { useProgress } from "@/components/classroom/ProgressContext";
import { LESSON_SCROLL_ID } from "@/components/classroom/ProgressTracker";
import { TUTOR_STREAM_END, type ChatMessage, type TutorStreamEnd } from "@/lib/tutor/protocol";

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
  /** The tutor link being hovered (desktop draws a line from it to the lesson). */
  activeAnchor: { blockId: string; chip: HTMLElement } | null;
  setActiveAnchor: (anchor: { blockId: string; chip: HTMLElement } | null) => void;
};

const TutorContext = createContext<TutorContextValue | null>(null);

export const useTutor = () => {
  const value = useContext(TutorContext);
  if (!value) throw new Error("useTutor needs a TutorProvider");
  return value;
};

/** The block at the top of the reader's screen: what "this" most likely refers to. */
function blockInView(): string | null {
  const container = document.getElementById(LESSON_SCROLL_ID);
  if (!container) return null;
  const top = container.getBoundingClientRect().top;
  const blocks = [...container.querySelectorAll<HTMLElement>("[data-block-id]")];
  const visible = blocks.find((b) => b.getBoundingClientRect().bottom > top + 80);
  return visible?.dataset.blockId ?? null;
}

let localId = 0;

export function TutorProvider({ courseId, lessonKey, children }: { courseId: string; lessonKey: string | undefined; children: React.ReactNode }) {
  const { userId, setCredit } = useProgress();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<TutorContextValue["status"]>("idle");
  const [error, setError] = useState<string | null>(null);
  const [needsCredit, setNeedsCredit] = useState(false);
  const [activeAnchor, setActiveAnchor] = useState<TutorContextValue["activeAnchor"]>(null);
  const requested = useRef(false);

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
      const anchorBlockId = blockInView();
      setMessages((m) => [
        ...m,
        { id: `local-${++localId}`, role: "user", content: message, lessonKey, anchorBlockId },
        { id: replyId, role: "assistant", content: "", lessonKey, anchorBlockId: null },
      ]);
      const setReply = (content: string) => setMessages((m) => m.map((x) => (x.id === replyId ? { ...x, content } : x)));
      const dropReply = () => setMessages((m) => m.filter((x) => x.id !== replyId));

      try {
        const response = await fetch("/api/tutor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ courseId, lessonKey, message, anchorBlockId }),
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
    [courseId, lessonKey, status, setCredit],
  );

  const value = useMemo(
    () => ({ messages, status, error, needsCredit, loadHistory, send, activeAnchor, setActiveAnchor }),
    [messages, status, error, needsCredit, loadHistory, send, activeAnchor],
  );
  return <TutorContext.Provider value={value}>{children}</TutorContext.Provider>;
}
