"use client";

import Link from "next/link";
import { useState } from "react";
import { LinkPending } from "@/components/ui/LinkPending";
import { ArrowLeftIcon, ChevronIcon } from "@/components/ui/icons";
import type { CourseOutline } from "@/lib/course/load";
import { useProgress, type LessonStatus } from "./ProgressContext";

const STATUS_LABEL: Record<LessonStatus, string> = {
  none: "",
  read: " (read, checks not finished)",
  done: " (completed)",
};

type CurriculumNavProps = {
  outline: CourseOutline;
  currentLessonId: string | undefined;
  onNavigate?: () => void;
};

export function CurriculumNav({ outline, currentLessonId, onNavigate }: CurriculumNavProps) {
  const { statusOf } = useProgress();
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
                  const status = statusOf(lesson.id);
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
                        {/*
                          Lesson number in a fixed 20px circle. The border is always there (transparent
                          when unused) so the number sits in exactly the same place in every state.
                          none: plain number · read: hollow green ring · done: filled green circle
                        */}
                        <span
                          className={`mt-px inline-flex size-5 shrink-0 items-center justify-center rounded-full border-[1.5px] text-[0.625rem] font-semibold leading-none tabular-nums ${
                            status === "done"
                              ? "border-progress bg-progress text-progress-contrast"
                              : status === "read"
                                ? "border-progress text-text"
                                : current
                                  ? "border-transparent text-accent"
                                  : "border-transparent text-faint"
                          }`}
                        >
                          {lessonNumbers.get(lesson.id)}
                          <span className="sr-only">{STATUS_LABEL[status]}</span>
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
