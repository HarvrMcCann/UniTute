import Link from "next/link";
import { LinkPending } from "@/components/ui/LinkPending";
import { SimpleHeader } from "@/components/ui/SimpleHeader";
import { ArrowRightIcon, ClockIcon, PlusIcon } from "@/components/ui/icons";
import { listCourses, listDraftCourses, type DraftCourse } from "@/lib/course/load";
import { getContinuePoints } from "@/lib/progress";
import { getProfile, getUser } from "@/lib/supabase/server";

export default async function HomePage() {
  const [user, profile, courses, continuePoints, drafts] = await Promise.all([
    getUser(),
    getProfile(),
    listCourses(),
    getContinuePoints(),
    listDraftCourses(),
  ]);
  const firstName = profile?.displayName?.split(" ")[0];

  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col px-4 sm:px-6">
      <SimpleHeader account={user ? { email: user.email, displayName: profile?.displayName ?? null } : null} />

      <main className="flex-1 pb-16 pt-10 sm:pt-20">
        {user ? (
          <>
            <h1 className="font-display text-4xl font-medium leading-tight tracking-tight sm:text-5xl">
              {firstName ? `Welcome back, ${firstName}.` : "Welcome back."}
            </h1>
            <Link
              href="/upload"
              className="pressable mt-8 inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-3 font-medium text-accent-contrast transition-opacity hover:opacity-90"
            >
              <PlusIcon className="size-4" /> New course from your files
            </Link>
            {drafts.length > 0 && <DraftList drafts={drafts} />}
          </>
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
                  className="pressable pressable-soft group relative flex items-center gap-4 overflow-hidden rounded-2xl border border-line bg-panel p-5 frost transition-colors hover:border-accent/40"
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
                  <LinkPending />
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

const DRAFT_STATUS: Record<string, string> = {
  draft: "Upload not finished",
  extracting: "Reading your files…",
  extracted: "Files ready",
  generating: "Building your course…",
  failed: "Something went wrong",
};

function DraftList({ drafts }: { drafts: DraftCourse[] }) {
  return (
    <>
      <h2 className="mt-12 text-sm font-medium uppercase tracking-wider text-faint">In progress</h2>
      <ul className="mt-4 space-y-3">
        {drafts.map((d) => (
          <li key={d.id}>
            <Link
              href={`/upload/${d.id}`}
              className="pressable pressable-soft group relative flex items-center gap-4 overflow-hidden rounded-2xl border border-line bg-panel p-4 frost transition-colors hover:border-accent/40"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{d.title}</p>
                <p className="mt-0.5 text-sm text-muted">
                  {d.courseCode && <>{d.courseCode} · </>}
                  {d.fileCount} file{d.fileCount === 1 ? "" : "s"} · {DRAFT_STATUS[d.status] ?? d.status}
                </p>
              </div>
              <ArrowRightIcon className="text-muted transition-transform group-hover:translate-x-1 group-hover:text-accent" />
              <LinkPending />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
