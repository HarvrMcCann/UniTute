import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SimpleHeader } from "@/components/ui/SimpleHeader";
import { AutoRefresh } from "@/components/upload/AutoRefresh";
import { BuildCourse } from "@/components/upload/BuildCourse";
import { ArrowRightIcon } from "@/components/ui/icons";
import { estimateCostUsd, type Usage } from "@/lib/generation/claude";
import { RetryExtraction } from "@/components/upload/RetryExtraction";
import { SourceFileRow, type SourceFile } from "@/components/upload/SourceFileRow";
import { createClient, getProfile, getUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Course files · UniTute" };

type Row = {
  id: string;
  box: "content" | "objectives";
  filename: string;
  kind: SourceFile["kind"];
  week: number | null;
  page_count: number | null;
  size_bytes: number | null;
  status: SourceFile["status"];
  error: string | null;
  char_count: number | null;
};

/** Reading normally takes seconds per file; after 2 minutes with nothing finished, offer a restart. */
const STALL_MS = 2 * 60 * 1000;

// Server-rendered once per request, so reading the clock here is fine.
function olderThan(timestamp: string, ms: number): boolean {
  return Date.now() - new Date(timestamp).getTime() > ms;
}

export default async function CourseFilesPage({ params }: PageProps<"/upload/[courseId]">) {
  const { courseId } = await params;
  const user = await getUser();
  if (!user) redirect(`/login?next=/upload/${courseId}`);

  const supabase = await createClient();
  const [{ data: course }, { data: rows }, { data: usageRows }, profile] = await Promise.all([
    supabase
      .from("courses")
      .select("id, title, course_code, status, updated_at, length_mode, generation_progress, generation_error")
      .eq("id", courseId)
      .maybeSingle(),
    supabase
      .from("source_files")
      .select("id, box, filename, kind, week, page_count, size_bytes, status, error, char_count")
      .eq("course_id", courseId)
      .order("filename"),
    supabase
      .from("generation_usage")
      .select("step, input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens")
      .eq("course_id", courseId),
    getProfile(),
  ]);
  if (!course) notFound();

  const files = (rows ?? []) as Row[];
  const toFile = (r: Row): SourceFile => ({
    id: r.id,
    filename: r.filename,
    kind: r.kind,
    week: r.week,
    pageCount: r.page_count,
    sizeBytes: r.size_bytes,
    status: r.status,
    error: r.error,
    charCount: r.char_count,
  });

  const working = files.filter((f) => f.status === "pending" || f.status === "extracting").length;
  const done = files.filter((f) => f.status === "done").length;
  const failed = files.filter((f) => f.status === "failed").length;
  const inProgress = course.status === "extracting" || working > 0;
  const stalled = inProgress && done + failed === 0 && olderThan(course.updated_at, STALL_MS);

  // Building the course (phase 5)
  const usage = (usageRows ?? []) as (Usage & { step: string })[];
  const lessonsWritten = usage.filter((u) => u.step.startsWith("lesson ")).length;
  const progress = course.generation_progress as { stage?: string; total?: number } | null;
  const generating = course.status === "generating";
  const buildFailed = course.status === "failed" && course.generation_error !== null;
  const canBuild = !inProgress && done > 0 && (course.status === "extracted" || buildFailed);
  const totals = usage.reduce(
    (t, u) => ({
      input_tokens: t.input_tokens + u.input_tokens,
      output_tokens: t.output_tokens + u.output_tokens,
      cache_creation_input_tokens: t.cache_creation_input_tokens + u.cache_creation_input_tokens,
      cache_read_input_tokens: t.cache_read_input_tokens + u.cache_read_input_tokens,
    }),
    { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
  );
  const tokenTotal = totals.input_tokens + totals.output_tokens + totals.cache_creation_input_tokens + totals.cache_read_input_tokens;

  // Content files grouped by week (weekless last), objectives separately.
  const content = files.filter((f) => f.box === "content");
  const weeks = [...new Set(content.map((f) => f.week))].sort((a, b) => (a ?? 99) - (b ?? 99));
  const objectives = files.filter((f) => f.box === "objectives");

  return (
    <div className="mx-auto min-h-dvh max-w-3xl px-4 pb-16 sm:px-6">
      <SimpleHeader account={{ email: user.email, displayName: profile?.displayName ?? null }} />
      <AutoRefresh active={inProgress || generating} everyMs={generating ? 5000 : 3000} />
      <main className="pt-6 sm:pt-10">
        {course.course_code && <p className="text-sm text-accent">{course.course_code}</p>}
        <h1 className="mt-1 font-display text-3xl font-medium tracking-tight sm:text-4xl">{course.title}</h1>

        <div
          role="status"
          className={`mt-6 rounded-2xl border px-5 py-4 frost ${
            course.status === "failed" && !buildFailed ? "border-mastery-low/40 bg-mastery-low/10" : "border-line bg-panel"
          }`}
        >
          {course.status === "ready" ? (
            <>
              <p className="font-medium text-mastery-high">Your course is ready.</p>
              <Link
                href={`/course/${course.id}`}
                className="pressable mt-3 inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-3 font-medium text-accent-contrast transition-opacity hover:opacity-90"
              >
                Open course <ArrowRightIcon className="size-4" />
              </Link>
              {tokenTotal > 0 && (
                <p className="mt-3 text-xs text-faint">
                  Built with {tokenTotal.toLocaleString()} tokens across {usage.length} Claude calls (about US$
                  {estimateCostUsd(totals).toFixed(2)}).
                </p>
              )}
            </>
          ) : generating ? (
            <>
              <p className="flex items-center gap-2 font-medium">
                <span className="size-2 animate-pulse rounded-full bg-accent" aria-hidden />
                {progress?.stage === "lessons" && progress.total
                  ? `Writing lessons: ${lessonsWritten} of ${progress.total} done`
                  : progress?.stage === "saving"
                    ? "Putting your course together…"
                    : "Planning your course…"}
              </p>
              <p className="mt-1 text-sm text-muted">
                Claude is reading your files and writing each lesson. This takes a few minutes; you can leave this page.
              </p>
            </>
          ) : course.status === "failed" && !buildFailed ? (
            <>
              <p className="font-medium text-mastery-low">
                {failed > 0 ? `${failed} file${failed === 1 ? "" : "s"} couldn’t be read.` : "Something went wrong reading your files."}
              </p>
              <RetryExtraction courseId={course.id} />
            </>
          ) : inProgress ? (
            <>
              <p className="flex items-center gap-2 font-medium">
                <span className="size-2 animate-pulse rounded-full bg-accent" aria-hidden />
                Reading your files: {done + failed} of {files.length} done
              </p>
              <p className="mt-1 text-sm text-muted">
                This usually takes a minute or two. You can leave this page and come back.
              </p>
              {stalled && <RetryExtraction courseId={course.id} prompt="Taking longer than it should?" />}
            </>
          ) : (
            <>
              <p className="font-medium text-mastery-high">
                All {files.length} files read{failed > 0 && `, ${failed} couldn’t be read`}. Check each file is in the right
                week, then build your course.
              </p>
              {buildFailed && (
                <p role="alert" className="mt-2 text-sm text-mastery-low">
                  The last attempt to build it failed: {course.generation_error}
                </p>
              )}
              {canBuild && (
                <div className="mt-5">
                  <BuildCourse courseId={course.id} initial={course.length_mode} />
                </div>
              )}
            </>
          )}
        </div>

        {weeks.map((week) => (
          <section key={week ?? "none"} className="mt-8">
            <h2 className="text-sm font-medium uppercase tracking-wider text-faint">
              {week === null ? "No particular week" : `Week ${week}`}
            </h2>
            <ul className="mt-3 space-y-2">
              {content
                .filter((f) => f.week === week)
                .map((f) => (
                  <SourceFileRow key={f.id} file={toFile(f)} />
                ))}
            </ul>
          </section>
        ))}

        {objectives.length > 0 && (
          <section className="mt-10">
            <h2 className="text-sm font-medium uppercase tracking-wider text-faint">Learning objectives</h2>
            <ul className="mt-3 space-y-2">
              {objectives.map((f) => (
                <SourceFileRow key={f.id} file={toFile(f)} />
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
