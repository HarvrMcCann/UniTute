import Link from "next/link";
import { BlockRenderer } from "@/components/blocks/BlockRenderer";
import { ArrowLeftIcon, ArrowRightIcon, ClockIcon } from "@/components/ui/icons";
import type { LessonLocation } from "@/lib/course/load";
import type { Course } from "@/lib/course/schema";
import { FadeIn } from "./FadeIn";
import { LESSON_END_ID, ProgressTracker } from "./ProgressTracker";

type LessonViewProps = {
  course: Course;
  location: LessonLocation;
  lessonDbId: string;
  resumeBlockId: string | null;
};

export function LessonView({ course, location, lessonDbId, resumeBlockId }: LessonViewProps) {
  const { unit, lesson, prev, next, number, total } = location;
  const questions = new Map(lesson.questions.map((q) => [q.id, q]));
  const conceptNames = new Map(course.concepts.map((c) => [c.id, c.name]));

  return (
    <>
      {/* Outside FadeIn: its transform would break the tracker's fixed-position chip */}
      <ProgressTracker
        key={lesson.id}
        courseId={course.id}
        lessonKey={lesson.id}
        lessonDbId={lessonDbId}
        resumeBlockId={resumeBlockId}
      />
      <FadeIn key={lesson.id}>
      <article className="mx-auto max-w-[720px] px-4 pb-24 pt-6 sm:px-6 sm:pt-10">
        <header>
          <p className="text-sm text-muted">
            {unit.week !== null && <>Week {unit.week} · </>}
            {unit.title}
          </p>
          <h1 className="mt-2 font-display text-3xl font-medium leading-tight tracking-tight sm:text-4xl">
            {lesson.title}
          </h1>
          <p className="mt-3 max-w-[62ch] text-lg leading-relaxed text-muted">{lesson.summary}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-muted">
            <span className="inline-flex items-center gap-1.5">
              <ClockIcon className="size-4" /> {lesson.estMinutes} min
            </span>
            <span aria-hidden>·</span>
            <span>
              Lesson {number} of {total}
            </span>
          </div>
          <ul className="mt-4 flex flex-wrap gap-2" aria-label="Concepts in this lesson">
            {lesson.conceptIds.map((id) => (
              <li key={id} className="rounded-full border border-line bg-panel px-3 py-1 text-xs text-muted">
                {conceptNames.get(id)}
              </li>
            ))}
          </ul>
        </header>

        <div className="mt-10 space-y-6">
          {lesson.blocks.map((block) => (
            <BlockRenderer key={block.id} block={block} questions={questions} />
          ))}
        </div>

        <nav id={LESSON_END_ID} aria-label="Lesson navigation" className="mt-14 grid gap-3 sm:grid-cols-2">
          {prev ? (
            <LessonLink href={`/course/${course.id}/${prev.id}`} label="Previous" title={prev.title} direction="prev" />
          ) : (
            <span className="hidden sm:block" />
          )}
          {next ? (
            <LessonLink href={`/course/${course.id}/${next.id}`} label="Next" title={next.title} direction="next" />
          ) : (
            <LessonLink href="/" label="You've finished the course" title="Back to your courses" direction="next" />
          )}
        </nav>
      </article>
      </FadeIn>
    </>
  );
}

function LessonLink({
  href,
  label,
  title,
  direction,
}: {
  href: string;
  label: string;
  title: string;
  direction: "prev" | "next";
}) {
  const next = direction === "next";
  return (
    <Link
      href={href}
      className={`group flex items-center gap-3 rounded-2xl border border-line bg-panel px-5 py-4 backdrop-blur-xl transition-colors hover:border-accent/40 ${
        next ? "sm:col-start-2 sm:flex-row-reverse sm:text-right" : ""
      }`}
    >
      {next ? (
        <ArrowRightIcon className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
      ) : (
        <ArrowLeftIcon className="shrink-0 text-muted transition-transform group-hover:-translate-x-0.5 group-hover:text-accent" />
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-xs text-muted">{label}</span>
        <span className="mt-0.5 block font-medium leading-snug">{title}</span>
      </span>
    </Link>
  );
}
