"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { restartExtraction } from "@/app/upload/actions";

/** Starts the reading job again for files that are stuck or failed. */
export function RetryExtraction({ courseId, prompt }: { courseId: string; prompt?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mt-3 flex flex-wrap items-center gap-3">
      {prompt && <p className="text-sm text-muted">{prompt}</p>}
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
