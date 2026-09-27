"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { restartExtraction } from "@/app/upload/actions";

/** Shown when files have sat unread for a while: starts the reading job again. */
export function RetryExtraction({ courseId }: { courseId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mt-3 flex flex-wrap items-center gap-3">
      <p className="text-sm text-muted">Taking longer than it should?</p>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await restartExtraction(courseId);
            if (result.ok) router.refresh();
            else setError(result.error);
          })
        }
        className="rounded-xl border border-line px-3 py-1.5 text-sm font-medium text-accent transition-colors hover:bg-hover disabled:opacity-50"
      >
        {pending ? "Starting…" : "Try again"}
      </button>
      {error && <p className="text-sm text-mastery-low">{error}</p>}
    </div>
  );
}
