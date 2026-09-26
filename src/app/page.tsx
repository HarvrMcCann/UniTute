import Link from "next/link";
import { AccountMenu } from "@/components/auth/AccountMenu";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { ArrowRightIcon, ClockIcon } from "@/components/ui/icons";
import { listCourses } from "@/lib/course/load";
import { getContinuePoints } from "@/lib/progress";
import { getProfile, getUser } from "@/lib/supabase/server";

export default async function HomePage() {
  const [user, profile, courses, continuePoints] = await Promise.all([
    getUser(),
    getProfile(),
    listCourses(),
    getContinuePoints(),
  ]);
  const firstName = profile?.displayName?.split(" ")[0];

  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col px-4 sm:px-6">
      <header className="flex items-center justify-between gap-2 py-4">
        <span className="flex-1 font-display text-xl font-semibold tracking-tight">UniTute</span>
        <ThemeToggle />
        <AccountMenu account={user ? { email: user.email, displayName: profile?.displayName ?? null } : null} />
      </header>

      <main className="flex-1 pb-16 pt-10 sm:pt-20">
        {user ? (
          <h1 className="font-display text-4xl font-medium leading-tight tracking-tight sm:text-5xl">
            {firstName ? `Welcome back, ${firstName}.` : "Welcome back."}
          </h1>
        ) : (
          <>
            <h1 className="font-display text-4xl font-medium leading-tight tracking-tight sm:text-5xl">
              Your lectures, turned into a course you can actually learn from.
            </h1>
            <p className="mt-5 max-w-[60ch] text-lg text-muted">
              Lessons, knowledge checks and an AI tutor, built from your own unit&rsquo;s slides and readings.
            </p>
            <Link
              href="/login"
              className="mt-8 inline-flex rounded-xl bg-accent px-5 py-3 font-medium text-accent-contrast transition-opacity hover:opacity-90"
            >
              Sign in to save your progress
            </Link>
          </>
        )}

        <h2 className="mt-14 text-sm font-medium uppercase tracking-wider text-faint">
          {user ? "Your courses" : "Try the sample course"}
        </h2>
        <ul className="mt-4 space-y-3">
          {courses.map((course) => {
            const resume = continuePoints.get(course.id);
            return (
              <li key={course.id}>
                <Link
                  href={`/course/${course.id}`}
                  className="group flex items-center gap-4 rounded-2xl border border-line bg-panel p-5 backdrop-blur-xl transition-colors hover:border-accent/40"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-accent">
                      {course.courseCode}
                      {course.isSample && <span className="text-faint"> · Sample</span>}
                    </p>
                    <p className="mt-1 font-display text-xl leading-snug">{course.title}</p>
                    <p className="mt-2 flex flex-wrap items-center gap-1.5 text-sm text-muted">
                      {resume ? (
                        <span>
                          Continue: <span className="text-text">{resume.lessonTitle}</span>
                        </span>
                      ) : (
                        <>
                          {course.lessonCount} lessons
                          <span aria-hidden>·</span>
                          <ClockIcon className="size-4" /> {course.minutes} min
                        </>
                      )}
                    </p>
                  </div>
                  <ArrowRightIcon className="text-muted transition-transform group-hover:translate-x-1 group-hover:text-accent" />
                </Link>
              </li>
            );
          })}
        </ul>
        {courses.length === 0 && (
          <p className="mt-4 text-muted">No courses yet. (If you&rsquo;re the developer: run the seed script.)</p>
        )}
      </main>
    </div>
  );
}
