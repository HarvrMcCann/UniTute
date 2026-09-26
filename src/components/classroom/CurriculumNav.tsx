"use client";

import Link from "next/link";
import { useState } from "react";
import { LinkPending } from "@/components/ui/LinkPending";
import { ArrowLeftIcon, ChevronIcon } from "@/components/ui/icons";
import type { CourseOutline } from "@/lib/course/load";
import { useProgress } from "./ProgressContext";

type CurriculumNavProps = {
  outline: CourseOutline;
  currentLessonId: string | undefined;
  onNavigate?: () => void;
};

export function CurriculumNav({ outline, currentLessonId, onNavigate }: CurriculumNavProps) {
  const { completed } = useProgress();
  const [collapsedUnits, setCollapsedUnits] = useState<Set<string>>(new Set());
  const lessonNumbers = new Map(
    outline.units.flatMap((u) => u.lessons).map((lesson, i) => [lesson.id, i + 1]),
  );

  function toggleUnit(unitId: string) {
    setCollapsedUnits((prev) => {
      const next = new Set(prev);
      if (next.has(unitId)) next.delete(unitId);
      else next.add(unitId);
      return next;
    });
  }

  return (
    <nav aria-label="Course curriculum" className="flex h-full flex-col">
      <div className="border-b border-line px-4 pb-4 pt-4">
        <Link
          href="/"
          onClick={onNavigate}
          className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-text"
        >
          <ArrowLeftIcon className="size-4" /> All courses
        </Link>
        {outline.courseCode && <p className="mt-3 text-xs font-medium text-accent">{outline.courseCode}</p>}
        <p className="mt-1 font-display text-lg leading-snug">{outline.title}</p>
      </div>

      <div className="scroll-thin flex-1 overflow-y-auto px-2 py-3">
        {outline.units.map((unit) => {
          const collapsed = collapsedUnits.has(unit.id);
          return (
            <div key={unit.id} className="mb-2">
              <button
                type="button"
                onClick={() => toggleUnit(unit.id)}
                aria-expanded={!collapsed}
                className="flex w-full items-start gap-2 rounded-xl px-2 py-2 text-left transition-colors hover:bg-hover"
              >
                <ChevronIcon
                  className={`mt-0.5 size-4 shrink-0 text-faint transition-transform ${collapsed ? "" : "rotate-90"}`}
                />
                <span className="min-w-0">
                  {unit.week !== null && (
                    <span className="block text-[0.7rem] font-semibold uppercase tracking-wider text-faint">
                      Week {unit.week}
                    </span>
                  )}
                  <span className="block text-sm font-semibold">{unit.title}</span>
                </span>
              </button>

              <ul className={collapsed ? "hidden" : "mt-0.5 space-y-0.5"}>
                {unit.lessons.map((lesson) => {
                  const current = lesson.id === currentLessonId;
                  const done = completed.has(lesson.id);
                  return (
                    <li key={lesson.id}>
                      <Link
                        href={`/course/${outline.id}/${lesson.id}`}
                        onClick={onNavigate}
                        aria-current={current ? "page" : undefined}
                        className={`pressable relative flex items-start gap-3 overflow-hidden rounded-xl py-2 pl-8 pr-3 text-sm transition-colors ${
                          current ? "bg-accent-soft text-text" : "text-muted hover:bg-hover hover:text-text"
                        }`}
                      >
                        {/* Lesson number; a completed lesson gets a filled accent ring around it */}
                        <span
                          className={`mt-px grid size-[1.125rem] shrink-0 place-items-center rounded-full text-[0.65rem] font-semibold tabular-nums ${
                            done
                              ? "bg-accent-soft text-accent ring-[1.5px] ring-accent"
                              : current
                                ? "text-accent"
                                : "text-faint"
                          }`}
                        >
                          {lessonNumbers.get(lesson.id)}
                          {done && <span className="sr-only"> (completed)</span>}
                        </span>
                        <span className="min-w-0 flex-1 leading-snug">{lesson.title}</span>
                        <span className="shrink-0 text-xs text-faint">{lesson.estMinutes}m</span>
                        <LinkPending />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </nav>
  );
}
