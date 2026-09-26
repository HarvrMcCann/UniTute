import { IconButton } from "@/components/ui/IconButton";
import { CloseIcon, SendIcon, SparkIcon } from "@/components/ui/icons";

type TutorPanelProps = {
  lessonTitle: string | undefined;
  onClose: () => void;
};

/** Tutor chat shell. Phase 7 connects it to Claude Haiku with the lesson and knowledge level in context. */
export function TutorPanel({ lessonTitle, onClose }: TutorPanelProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-line py-1 pl-4 pr-1.5">
        <SparkIcon className="size-4 text-accent" />
        <p className="flex-1 font-display text-base">Tutor</p>
        <IconButton label="Close tutor" onClick={onClose} size="sm">
          <CloseIcon />
        </IconButton>
      </div>

      <div className="scroll-thin flex flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-8 text-center">
        <div className="grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent">
          <SparkIcon className="size-6" />
        </div>
        <p className="mt-4 font-display text-lg">Your tutor is on the way</p>
        <p className="mt-2 max-w-[28ch] text-sm leading-relaxed text-muted">
          Soon you&rsquo;ll be able to ask about anything in{" "}
          {lessonTitle ? <span className="text-text">{lessonTitle}</span> : "this lesson"}, and answers will link
          back to the part of the lesson they&rsquo;re about.
        </p>
      </div>

      <form className="border-t border-line p-3" onSubmit={(e) => e.preventDefault()}>
        <div className="flex items-end gap-2 rounded-xl border border-line bg-code px-3 py-2 opacity-60">
          <textarea
            disabled
            rows={1}
            aria-label="Message the tutor"
            placeholder="Ask a question…"
            className="max-h-32 flex-1 resize-none bg-transparent py-1.5 text-base outline-none placeholder:text-faint"
          />
          <IconButton label="Send" disabled size="sm">
            <SendIcon className="size-4" />
          </IconButton>
        </div>
      </form>
    </div>
  );
}
