"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnchorChip, flashBlock } from "@/components/tutor/AnchorChip";
import { blockInView, DRAFT_CHIP_ID, useTutor } from "@/components/tutor/TutorProvider";
import { IconButton } from "@/components/ui/IconButton";
import { CloseIcon, SendIcon, SparkIcon } from "@/components/ui/icons";
import { formatCredit, MIN_CREDIT_USD } from "@/lib/credits";
import { splitQuote } from "@/lib/tutor/protocol";
import { useProgress } from "./ProgressContext";

// Markdown + KaTeX for replies only loads once the tutor is used.
const ChatMarkdown = dynamic(() => import("@/components/tutor/ChatMarkdown"), {
  loading: () => <p className="text-sm text-faint">…</p>,
});

const SUGGESTIONS = ["Explain this part more simply", "Give me a practice question on this", "What's the one idea to remember here?"];

type TutorPanelProps = {
  courseId: string;
  lessonTitle: string | undefined;
  onClose: () => void;
};

/** Tutor chat (Claude Haiku) about the current lesson, aware of the student's knowledge level. */
export function TutorPanel({ courseId, lessonTitle, onClose }: TutorPanelProps) {
  const { userId, credit } = useProgress();
  const { messages, status, error, needsCredit, loadHistory, send, setInputFocused, focusRequest } = useTutor();
  const pathname = usePathname();
  const [draft, setDraft] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const sending = status === "sending";
  const outOfCredit = needsCredit || credit < MIN_CREDIT_USD;
  const canChat = Boolean(userId && lessonTitle && !outOfCredit);

  useEffect(loadHistory, [loadHistory]);

  // "Ask tutor" on highlighted text: focus this box if it's the one on screen.
  useEffect(() => {
    const el = input.current;
    if (el && Date.now() - focusRequest < 1500 && el.getClientRects().length > 0) el.focus();
  }, [focusRequest]);

  // Keep the newest message in view as replies stream in.
  const last = messages.at(-1);
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, last?.content]);

  function submit(text = draft) {
    if (!canChat || sending || !text.trim()) return;
    send(text);
    setDraft("");
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-line py-1 pl-4 pr-1.5">
        <SparkIcon className="size-4 text-accent" />
        <p className="flex-1 font-display text-base">Tutor</p>
        <IconButton label="Close tutor" onClick={onClose} size="sm">
          <CloseIcon />
        </IconButton>
      </div>

      <div ref={scroller} className="scroll-thin flex-1 overflow-y-auto px-3 py-4" aria-live="polite">
        {messages.length === 0 ? (
          <EmptyState
            signedIn={Boolean(userId)}
            lessonTitle={lessonTitle}
            loading={status === "loading"}
            onSuggest={canChat ? submit : undefined}
            loginHref={`/login?next=${encodeURIComponent(pathname)}`}
          />
        ) : (
          <ul className="space-y-4">
            {messages.map((m) =>
              m.role === "user" ? (
                <li key={m.id} className="ml-8 flex flex-col items-end gap-1">
                  <UserMessage content={m.content} />
                  {m.anchorBlockId && <AnchorChip courseId={courseId} blockId={m.anchorBlockId} lessonKey={m.lessonKey} prefix="About" />}
                </li>
              ) : (
                <li key={m.id} className="mr-2">
                  {m.content ? (
                    <ChatMarkdown text={m.content} />
                  ) : (
                    <TypingDots />
                  )}
                </li>
              ),
            )}
          </ul>
        )}
        {error && <p className="mt-4 rounded-xl bg-mastery-low/12 px-3 py-2 text-sm text-mastery-low">{error}</p>}
      </div>

      <form
        className="border-t border-line p-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {canChat && <DraftAnchorRow />}
        <div
          className={`flex items-end gap-2 rounded-xl border border-line bg-code px-3 py-2 transition-shadow focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/25 ${canChat ? "" : "opacity-60"}`}
        >
          <textarea
            ref={input}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }}
            disabled={!canChat}
            rows={1}
            maxLength={2000}
            aria-label="Message the tutor"
            placeholder={lessonTitle ? "Ask about this lesson…" : "Open a lesson to ask about it"}
            className="field-sizing-content max-h-32 min-h-9 flex-1 resize-none bg-transparent py-1.5 text-base outline-none placeholder:text-faint focus-visible:outline-none"
          />
          <IconButton label="Send" type="submit" disabled={!canChat || sending || !draft.trim()} size="sm">
            <SendIcon className="size-4" />
          </IconButton>
        </div>
        {userId && (
          <p className="mt-1.5 px-1 text-[0.7rem] text-faint">
            {outOfCredit ? "The tutor runs on credit. Top-ups are coming soon." : `Each answer uses a fraction of a cent · ${formatCredit(credit)} left`}
          </p>
        )}
      </form>
    </div>
  );
}

/** A question, with the text it's about quoted above it when asked from a highlight. */
function UserMessage({ content }: { content: string }) {
  const { quote, text } = splitQuote(content);
  return (
    <div className="rounded-2xl rounded-br-md bg-accent-soft px-3.5 py-2 text-[0.9375rem]">
      {quote && <p className="mb-1.5 line-clamp-3 border-l-2 border-accent/50 pl-2 text-sm italic text-muted">{quote}</p>}
      <p className="whitespace-pre-wrap">{text}</p>
    </div>
  );
}

/**
 * What the next question will be linked to. It follows the part at the top of the screen as you
 * read, unless you highlighted text ("Ask tutor") or unlinked it.
 */
function DraftAnchorRow() {
  const { draft, setDraft } = useTutor();
  // Rendered only in the browser after the lesson is on screen (draft starts empty on the server).
  const target = draft.blockId ? document.getElementById(draft.blockId) : null;

  if (!target) {
    return (
      <p className="mb-2 flex items-center gap-2 px-1 text-xs text-faint">
        Not linked to a part of the lesson
        {draft.pinned && (
          <button type="button" onClick={() => setDraft({ blockId: blockInView(), quote: null, pinned: false })} className="text-accent hover:underline">
            Link to what I&rsquo;m reading
          </button>
        )}
      </p>
    );
  }

  return (
    <div className="mb-2 flex items-start gap-1.5 px-1 text-xs">
      <span className="shrink-0 pt-0.5 text-faint">Linked to</span>
      <div className="min-w-0 flex-1">
        <button
          type="button"
          data-chip-id={DRAFT_CHIP_ID}
          onClick={() => {
            target.scrollIntoView({ behavior: "smooth", block: "center" });
            flashBlock(target);
          }}
          className="inline-flex max-w-full items-center gap-1 rounded-full border border-accent/40 bg-accent-soft px-2 py-0.5 font-medium text-accent hover:border-accent"
        >
          <span aria-hidden>↗</span>
          <span className="truncate">{target.dataset.blockLabel ?? "this part"}</span>
        </button>
        {draft.quote && <p className="mt-1 line-clamp-2 border-l-2 border-accent/50 pl-2 italic text-muted">{draft.quote}</p>}
      </div>
      <button
        type="button"
        aria-label="Don't link this question"
        title="Don't link this question"
        onClick={() => setDraft({ blockId: null, quote: null, pinned: true })}
        className="grid size-5 shrink-0 place-items-center rounded-full text-faint hover:bg-hover hover:text-text"
      >
        ×
      </button>
    </div>
  );
}

function EmptyState({
  signedIn,
  lessonTitle,
  loading,
  onSuggest,
  loginHref,
}: {
  signedIn: boolean;
  lessonTitle: string | undefined;
  loading: boolean;
  onSuggest?: (text: string) => void;
  loginHref: string;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-3 text-center">
      <div className="grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent">
        <SparkIcon className="size-6" />
      </div>
      <p className="mt-4 font-display text-lg">Ask your tutor</p>
      <p className="mt-2 max-w-[30ch] text-sm leading-relaxed text-muted">
        {signedIn ? (
          <>
            Questions about {lessonTitle ? <span className="text-text">{lessonTitle}</span> : "a lesson"}, worked steps, or a practice
            question. Answers link back to the part of the lesson they&rsquo;re about.
          </>
        ) : (
          <>
            <Link href={loginHref} className="text-accent hover:underline">
              Sign in
            </Link>{" "}
            to chat with a tutor that knows this lesson and where you&rsquo;re up to.
          </>
        )}
      </p>
      {loading && <p className="mt-3 text-xs text-faint">Loading your chat…</p>}
      {onSuggest && !loading && (
        <div className="mt-5 flex flex-col gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onSuggest(s)}
              className="rounded-full border border-line px-3 py-1.5 text-sm text-muted transition-colors hover:border-accent/50 hover:text-text"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex gap-1 py-2" aria-label="The tutor is writing">
      {[0, 1, 2].map((i) => (
        <span key={i} className="size-1.5 animate-pulse rounded-full bg-faint motion-reduce:animate-none" style={{ animationDelay: `${i * 150}ms` }} />
      ))}
    </span>
  );
}
