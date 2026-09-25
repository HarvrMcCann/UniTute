import Link from "next/link";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { ArrowRightIcon, ClockIcon } from "@/components/ui/icons";
import { allLessons, listCourses } from "@/lib/course/load";

export default function HomePage() {
  const courses = listCourses();

  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col px-4 sm:px-6">
      <header className="flex items-center justify-between py-4">
        <span className="font-display text-xl font-semibold tracking-tight">UniTute</span>
        <ThemeToggle />
      </header>

      <main className="flex-1 pb-16 pt-10 sm:pt-20">
        <h1 className="font-display text-4xl font-medium leading-tight tracking-tight sm:text-5xl">
          Your lectures, turned into a course you can actually learn from.
        </h1>
        <p className="mt-5 max-w-[60ch] text-lg text-muted">
          Lessons, knowledge checks and an AI tutor, built from your own unit&rsquo;s slides and readings.
        </p>

        <h2 className="mt-14 text-sm font-medium uppercase tracking-wider text-faint">Your courses</h2>
        <ul className="mt-4 space-y-3">
          {courses.map((course) => {
            const lessons = allLessons(course);
            const minutes = lessons.reduce((sum, l) => sum + l.estMinutes, 0);
            return (
              <li key={course.id}>
                <Link
                  href={`/course/${course.id}`}
                  className="group flex items-center gap-4 rounded-2xl border border-line bg-panel p-5 backdrop-blur-xl transition-colors hover:border-accent/40"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-accent">{course.courseCode}</p>
                    <p className="mt-1 font-display text-xl leading-snug">{course.title}</p>
                    <p className="mt-2 flex items-center gap-1.5 text-sm text-muted">
                      {lessons.length} lessons
                      <span aria-hidden>·</span>
                      <ClockIcon className="size-4" /> {minutes} min
                    </p>
                  </div>
                  <ArrowRightIcon className="text-muted transition-transform group-hover:translate-x-1 group-hover:text-accent" />
                </Link>
              </li>
            );
          })}
        </ul>
      </main>
    </div>
  );
}
