"use client";

import { useState, useTransition } from "react";
import { reportProblem } from "@/app/actions";
import { FlagIcon } from "@/components/ui/icons";
import { useProgress } from "./ProgressContext";

type ReportProblemProps = {
  courseId: string;
  lessonKey: string;
  /** Parts of the lesson to choose from (headings, examples, interactives...). */
  parts: { id: string; label: string }[];
};

/** End of a lesson: tell the course owner something's wrong (a mistake, a broken interactive, a confusing bit). */
export function ReportProblem({ courseId, lessonKey, parts }: ReportProblemProps) {
  const { userId } = useProgress();
  const [open, setOpen] = useState(false);
  const [part, setPart] = useState("");
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "sent" | "failed">("idle");
  const [pending, startTransition] = useTransition();
  if (!userId) return null;

  if (state === "sent") {
    return <p className="mt-6 text-center text-sm text-muted">Thanks. The course owner will see your report.</p>;
  }

  if (!open) {
    return (
      <div className="mt-6 text-center">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 text-sm text-faint transition-colors hover:text-text"
        >
          <FlagIcon className="size-4" /> Report a problem with this lesson
        </button>
      </div>
    );
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const ok = await reportProblem({ courseId, lessonKey, blockId: part || null, note }).catch(() => false);
      setState(ok ? "sent" : "failed");
    });
  }

  return (
    <form onSubmit={submit} className="mt-6 rounded-2xl border border-line bg-panel p-4 frost">
      <p className="font-medium">Report a problem</p>
      <label className="mt-3 block text-sm text-muted">
        Which part?
        <select
          value={part}
          onChange={(e) => setPart(e.target.value)}
          className="mt-1 block w-full rounded-lg border border-line bg-code px-3 py-2 text-base text-text"
        >
          <option value="">The whole lesson</option>
          {parts.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      <label className="mt-3 block text-sm text-muted">
        What&rsquo;s wrong?
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          maxLength={2000}
          required
          placeholder="e.g. step 3 of the worked example has the wrong sign"
          className="mt-1 block w-full resize-y rounded-lg border border-line bg-code px-3 py-2 text-base text-text placeholder:text-faint"
        />
      </label>
      {state === "failed" && <p className="mt-2 text-sm text-mastery-low">Couldn&rsquo;t send that. Try again.</p>}
      <div className="mt-3 flex justify-end gap-3 text-sm">
        <button type="button" onClick={() => setOpen(false)} className="text-muted hover:text-text">
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending || !note.trim()}
          className="rounded-lg bg-accent px-3 py-1.5 font-medium text-accent-contrast transition active:scale-[0.97] disabled:opacity-50"
        >
          {pending ? "Sending…" : "Send report"}
        </button>
      </div>
    </form>
  );
}
