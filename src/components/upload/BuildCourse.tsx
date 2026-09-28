"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { startGeneration } from "@/app/upload/actions";

type LengthMode = "cram" | "recommended" | "deep";

const OPTIONS: { value: LengthMode; label: string; detail: string }[] = [
  { value: "cram", label: "Cram", detail: "About 1 short lesson per week. Just the essentials, for when the exam is close." },
  { value: "recommended", label: "Recommended", detail: "2–3 lessons per week with worked examples. Covers everything taught." },
  { value: "deep", label: "Deep", detail: "3–5 lessons per week. Derivations, more examples and more practice." },
];

/** Course-length choice and the button that starts building the course. */
export function BuildCourse({ courseId, initial }: { courseId: string; initial: LengthMode }) {
  const router = useRouter();
  const [mode, setMode] = useState<LengthMode>(initial);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <fieldset>
        <legend className="font-display text-lg">How deep should your course go?</legend>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {OPTIONS.map((o) => (
            <label
              key={o.value}
              className={`cursor-pointer rounded-xl border p-3.5 transition-colors ${
                mode === o.value ? "border-accent bg-accent-soft" : "border-line hover:bg-hover"
              }`}
            >
              <input
                type="radio"
                name="length"
                value={o.value}
                checked={mode === o.value}
                onChange={() => setMode(o.value)}
                className="sr-only"
              />
              <span className="block font-medium">{o.label}</span>
              <span className="mt-1 block text-sm leading-snug text-muted">{o.detail}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const result = await startGeneration(courseId, mode);
              if (result.ok) router.refresh();
              else setError(result.error);
            })
          }
          className="rounded-xl bg-accent px-5 py-3 font-medium text-accent-contrast transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Starting…" : "Build my course"}
        </button>
        <p className="text-sm text-muted">Takes a few minutes. You can leave this page.</p>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-mastery-low">
          {error}
        </p>
      )}
    </div>
  );
}
