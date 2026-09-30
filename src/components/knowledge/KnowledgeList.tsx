"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { setMasteryOverride } from "@/app/actions";
import { MASTERY_LABEL, MasteryBar } from "@/components/classroom/MasteryBar";
import { useProgress } from "@/components/classroom/ProgressContext";
import { averageScore, effectiveScore, levelOf, type MasteryState } from "@/lib/mastery";

export type KnowledgeConcept = {
  key: string;
  dbId: string;
  name: React.ReactNode;
  description: React.ReactNode | null;
  lessonHref: string;
  lessonTitle: string;
};

export type KnowledgeUnit = { id: string; title: string; week: number | null; concepts: KnowledgeConcept[] };

const percent = (score: number) => `${Math.round(score * 100)}%`;

/** Every concept's level, grouped by unit, with a way to set your own. Levels come from the live progress context. */
export function KnowledgeList({ units }: { units: KnowledgeUnit[] }) {
  const { mastery } = useProgress();
  return (
    <div className="mt-8 space-y-6">
      {units
        .filter((u) => u.concepts.length)
        .map((unit) => {
          const overall = averageScore(unit.concepts.map((c) => effectiveScore(mastery[c.key])));
          return (
            <section key={unit.id} className="rounded-2xl border border-line bg-panel p-4 frost sm:p-5">
              <div className="flex items-end justify-between gap-4">
                <div>
                  {unit.week !== null && (
                    <p className="text-[0.7rem] font-semibold uppercase tracking-wider text-faint">Week {unit.week}</p>
                  )}
                  <h2 className="font-display text-xl">{unit.title}</h2>
                </div>
                {overall !== null && <span className="shrink-0 text-sm tabular-nums text-muted">{percent(overall)} overall</span>}
              </div>
              <ul className="mt-3 divide-y divide-line">
                {unit.concepts.map((concept) => (
                  <ConceptRow key={concept.key} concept={concept} state={mastery[concept.key] ?? null} />
                ))}
              </ul>
            </section>
          );
        })}
    </div>
  );
}

function ConceptRow({ concept, state }: { concept: KnowledgeConcept; state: MasteryState | null }) {
  const { setMastery } = useProgress();
  const score = effectiveScore(state);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(Math.round((score ?? 0.5) * 100));
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();

  function save(value: number | null) {
    setError(false);
    startTransition(async () => {
      const ok = await setMasteryOverride({ conceptDbId: concept.dbId, value });
      if (!ok) return setError(true);
      setMastery(concept.key, { score: state?.score ?? 0, attempts: state?.attempts ?? 0, override: value });
      setEditing(false);
    });
  }

  const answers = state?.attempts ?? 0;
  return (
    <li className="py-3">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-1">
        <div className="min-w-0 flex-1 basis-56">
          <p className="font-medium">{concept.name}</p>
          {concept.description && <p className="mt-0.5 text-sm text-muted">{concept.description}</p>}
          <Link href={concept.lessonHref} className="mt-0.5 inline-block text-xs text-faint hover:text-accent">
            {concept.lessonTitle}
          </Link>
        </div>
        <div className="w-40 shrink-0 text-right">
          {score === null ? (
            <p className="text-sm text-faint">Not tested yet</p>
          ) : (
            <>
              <p className="text-sm tabular-nums">
                {percent(score)} <span className="text-muted">· {MASTERY_LABEL[levelOf(score)]}</span>
              </p>
              <MasteryBar score={score} className="ml-auto mt-1.5 w-full" />
            </>
          )}
          <p className="mt-1 text-xs text-faint">
            {state?.override != null ? "Set by you" : answers ? `${answers} answer${answers === 1 ? "" : "s"}` : ""}
            {!editing && (
              <button
                type="button"
                onClick={() => {
                  setDraft(Math.round((score ?? 0.5) * 100));
                  setEditing(true);
                }}
                className="ml-2 text-accent hover:underline"
              >
                Adjust
              </button>
            )}
          </p>
        </div>
      </div>

      {editing && (
        <div className="mt-3 rounded-xl bg-hover px-3 py-3">
          <label className="flex items-center gap-3 text-sm">
            <span className="shrink-0 text-muted">My level</span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={draft}
              disabled={pending}
              onChange={(e) => setDraft(Number(e.target.value))}
              className="min-w-0 flex-1 accent-[var(--accent)]"
            />
            <span className="w-10 shrink-0 text-right tabular-nums">{draft}%</span>
          </label>
          {error && <p className="mt-2 text-sm text-mastery-low">Couldn&rsquo;t save that. Try again.</p>}
          <div className="mt-3 flex flex-wrap justify-end gap-3 text-sm">
            {state?.override != null && (
              <button type="button" disabled={pending} onClick={() => save(null)} className="mr-auto text-muted hover:text-text">
                Use my answers instead
              </button>
            )}
            <button type="button" disabled={pending} onClick={() => setEditing(false)} className="text-muted hover:text-text">
              Cancel
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => save(draft / 100)}
              className="rounded-lg bg-accent px-3 py-1.5 font-medium text-accent-contrast transition active:scale-[0.97] disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
