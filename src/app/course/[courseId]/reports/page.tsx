import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { allLessons, getCourse } from "@/lib/course/load";
import { createClient, getUser } from "@/lib/supabase/server";
import { blockLabel } from "@/lib/tutor/context";

export const metadata: Metadata = { title: "Problem reports · UniTute" };

/** Owner-only: what students have flagged in this course, newest first. */
export default async function ReportsPage({ params }: PageProps<"/course/[courseId]/reports">) {
  const { courseId } = await params;
  const [loaded, user] = await Promise.all([getCourse(courseId), getUser()]);
  if (!loaded || !user || user.id !== loaded.ownerId) notFound();

  const supabase = await createClient();
  const { data: reports } = await supabase
    .from("bug_reports")
    .select("id, lesson_key, block_id, note, created_at")
    .eq("course_id", courseId)
    .order("created_at", { ascending: false })
    .limit(200);

  const lessons = new Map(allLessons(loaded.course).map((l) => [l.id, l]));
  const dateFormat = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

  return (
    <article className="mx-auto max-w-[720px] px-4 pb-24 pt-6 sm:px-6 sm:pt-10">
      <p className="text-sm text-muted">{loaded.course.title}</p>
      <h1 className="mt-2 font-display text-3xl font-medium tracking-tight">Problem reports</h1>
      <p className="mt-3 text-muted">What people studying this course have flagged. Only you can see these.</p>

      {!reports?.length ? (
        <p className="mt-8 rounded-2xl border border-line bg-panel p-5 text-muted frost">No reports yet.</p>
      ) : (
        <ul className="mt-8 space-y-3">
          {reports.map((r) => {
            const lesson = r.lesson_key ? lessons.get(r.lesson_key) : undefined;
            const block = lesson?.blocks.find((b) => b.id === r.block_id);
            const questions = new Map(lesson?.questions.map((q) => [q.id, q]));
            return (
              <li key={r.id} className="rounded-2xl border border-line bg-panel p-4 frost">
                <p className="text-xs text-faint">{dateFormat.format(new Date(r.created_at))}</p>
                <p className="mt-1 whitespace-pre-wrap">{r.note}</p>
                {lesson && (
                  <Link href={`/course/${courseId}/${lesson.id}${block ? `#${block.id}` : ""}`} className="mt-2 inline-block text-sm text-accent hover:underline">
                    {lesson.title}
                    {block ? ` · ${blockLabel(block, questions)}` : ""}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </article>
  );
}
