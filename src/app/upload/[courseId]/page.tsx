import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { SimpleHeader } from "@/components/ui/SimpleHeader";
import { AutoRefresh } from "@/components/upload/AutoRefresh";
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

export default async function CourseFilesPage({ params }: PageProps<"/upload/[courseId]">) {
  const { courseId } = await params;
  const user = await getUser();
  if (!user) redirect(`/login?next=/upload/${courseId}`);

  const supabase = await createClient();
  const [{ data: course }, { data: rows }, profile] = await Promise.all([
    supabase.from("courses").select("id, title, course_code, status").eq("id", courseId).maybeSingle(),
    supabase
      .from("source_files")
      .select("id, box, filename, kind, week, page_count, size_bytes, status, error, char_count")
      .eq("course_id", courseId)
      .order("filename"),
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

  // Content files grouped by week (weekless last), objectives separately.
  const content = files.filter((f) => f.box === "content");
  const weeks = [...new Set(content.map((f) => f.week))].sort((a, b) => (a ?? 99) - (b ?? 99));
  const objectives = files.filter((f) => f.box === "objectives");

  return (
    <div className="mx-auto min-h-dvh max-w-3xl px-4 pb-16 sm:px-6">
      <SimpleHeader account={{ email: user.email, displayName: profile?.displayName ?? null }} />
      <AutoRefresh active={inProgress} />
      <main className="pt-6 sm:pt-10">
        {course.course_code && <p className="text-sm text-accent">{course.course_code}</p>}
        <h1 className="mt-1 font-display text-3xl font-medium tracking-tight sm:text-4xl">{course.title}</h1>

        <div
          role="status"
          className={`mt-6 rounded-2xl border px-5 py-4 frost ${
            course.status === "failed" ? "border-mastery-low/40 bg-mastery-low/10" : "border-line bg-panel"
          }`}
        >
          {course.status === "failed" ? (
            <p className="font-medium text-mastery-low">Something went wrong reading your files. Try uploading them again.</p>
          ) : inProgress ? (
            <>
              <p className="flex items-center gap-2 font-medium">
                <span className="size-2 animate-pulse rounded-full bg-accent" aria-hidden />
                Reading your files: {done + failed} of {files.length} done
              </p>
              <p className="mt-1 text-sm text-muted">
                This usually takes a minute or two. You can leave this page and come back.
              </p>
            </>
          ) : (
            <>
              <p className="font-medium text-mastery-high">
                All {files.length} files read{failed > 0 && `, ${failed} couldn’t be read`}.
              </p>
              <p className="mt-1 text-sm text-muted">
                Check each file is in the right week. Turning them into your course is the next step (coming soon).
              </p>
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
