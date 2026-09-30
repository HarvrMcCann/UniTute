"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { fixInteractive } from "@/app/actions";

export type WidgetFixTarget = { courseId: string; lessonKey: string; blockId: string };

/** Owner-only: describe what's wrong with an interactive and have Claude rewrite it. */
export function WidgetFixForm({ target, errorMessage }: { target: WidgetFixTarget; errorMessage: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [report, setReport] = useState("");
  const [status, setStatus] = useState<{ kind: "error" | "done"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <div className="flex flex-col items-end gap-1">
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setStatus(null);
          }}
          className="text-xs text-faint hover:text-text"
        >
          {errorMessage ? "Ask Claude to fix it" : "Something wrong? Fix it"}
        </button>
        {status?.kind === "done" && <p className="text-xs text-accent">{status.text}</p>}
      </div>
    );
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = [report.trim(), errorMessage ? `(The interactive reported this error: ${errorMessage})` : ""].filter(Boolean).join("\n");
    setStatus(null);
    startTransition(async () => {
      try {
        const result = await fixInteractive({ ...target, report: text });
        if (result.ok) {
          setOpen(false);
          setReport("");
          setStatus({ kind: "done", text: "Fixed. Here's the updated version." });
          router.refresh();
        } else {
          setStatus({ kind: "error", text: result.reason });
        }
      } catch {
        setStatus({ kind: "error", text: "Something went wrong reaching the server. Try again." });
      }
    });
  }

  return (
    <form onSubmit={submit} className="basis-full rounded-xl border border-line bg-panel p-3 text-left">
      <label htmlFor={`fix-${target.blockId}`} className="text-sm font-medium">
        What&rsquo;s wrong with this interactive?
      </label>
      <textarea
        id={`fix-${target.blockId}`}
        value={report}
        onChange={(e) => setReport(e.target.value)}
        maxLength={900}
        rows={3}
        disabled={pending}
        placeholder={errorMessage ? "Optional: anything else you noticed" : "e.g. the labels overlap the graph, or the slider doesn't change anything"}
        className="mt-2 w-full resize-y rounded-lg border border-line bg-hover px-3 py-2 text-sm text-text placeholder:text-faint focus:border-accent focus:outline-none"
      />
      {status?.kind === "error" && <p className="mt-2 text-sm text-mastery-low">{status.text}</p>}
      <div className="mt-2 flex items-center justify-end gap-3">
        {pending && <p className="mr-auto text-xs text-muted">Claude is rewriting it. This takes about a minute&hellip;</p>}
        <button type="button" onClick={() => setOpen(false)} disabled={pending} className="text-sm text-muted hover:text-text disabled:opacity-50">
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending || (!report.trim() && !errorMessage)}
          className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-contrast transition active:scale-[0.97] disabled:opacity-50"
        >
          {pending ? "Fixing…" : "Fix it"}
        </button>
      </div>
    </form>
  );
}
