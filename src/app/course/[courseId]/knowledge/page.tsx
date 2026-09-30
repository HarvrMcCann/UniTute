import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Markdown } from "@/components/blocks/Markdown";
import { KnowledgeList, type KnowledgeUnit } from "@/components/knowledge/KnowledgeList";
import { getCourse } from "@/lib/course/load";
import { getUser } from "@/lib/supabase/server";

export async function generateMetadata({ params }: PageProps<"/course/[courseId]/knowledge">): Promise<Metadata> {
  const { courseId } = await params;
  const loaded = await getCourse(courseId);
  return { title: loaded ? `Knowledge level: ${loaded.course.title} · UniTute` : "UniTute" };
}

export default async function KnowledgePage({ params }: PageProps<"/course/[courseId]/knowledge">) {
  const { courseId } = await params;
  const [loaded, user] = await Promise.all([getCourse(courseId), getUser()]);
  if (!loaded) notFound();
  const { course, conceptIds } = loaded;

  // Each concept is listed under the first unit that teaches it.
  const conceptsByKey = new Map(course.concepts.map((c) => [c.id, c]));
  const listed = new Set<string>();
  const units: KnowledgeUnit[] = course.units.map((unit) => ({
    id: unit.id,
    title: unit.title,
    week: unit.week,
    concepts: unit.lessons
      .flatMap((lesson) => lesson.conceptIds.map((key) => ({ key, lesson })))
      .filter(({ key }) => conceptsByKey.has(key) && !listed.has(key) && listed.add(key))
      .map(({ key, lesson }) => {
        const concept = conceptsByKey.get(key)!;
        return {
          key,
          dbId: conceptIds.get(key)!,
          name: <Markdown inline>{concept.name}</Markdown>,
          description: concept.description ? <Markdown inline>{concept.description}</Markdown> : null,
          lessonHref: `/course/${course.id}/${lesson.id}`,
          lessonTitle: lesson.title,
        };
      }),
  }));

  return (
    <article className="mx-auto max-w-[720px] px-4 pb-24 pt-6 sm:px-6 sm:pt-10">
      <p className="text-sm text-muted">{course.title}</p>
      <h1 className="mt-2 font-display text-3xl font-medium tracking-tight">Knowledge level</h1>
      <p className="mt-3 max-w-[62ch] text-muted">
        How well you know each idea in this course, from your answers to the knowledge checks. Early answers move it quickly,
        later ones fine-tune it. If it&rsquo;s off, set it yourself: your setting holds until you next answer a question on that
        idea, which then carries on from it.
      </p>
      {user ? (
        <KnowledgeList units={units} />
      ) : (
        <p className="mt-8 rounded-2xl border border-line bg-panel p-5 frost">
          <Link href={`/login?next=/course/${course.id}/knowledge`} className="text-accent hover:underline">
            Sign in
          </Link>{" "}
          to track your knowledge level as you answer questions.
        </p>
      )}
    </article>
  );
}
