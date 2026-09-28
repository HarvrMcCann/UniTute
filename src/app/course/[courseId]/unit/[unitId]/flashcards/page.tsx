import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Markdown } from "@/components/blocks/Markdown";
import { FlashcardDeck } from "@/components/study/FlashcardDeck";
import { getCourse } from "@/lib/course/load";

export async function generateMetadata({ params }: PageProps<"/course/[courseId]/unit/[unitId]/flashcards">): Promise<Metadata> {
  const { courseId, unitId } = await params;
  const unit = (await getCourse(courseId))?.course.units.find((u) => u.id === unitId);
  return { title: unit ? `Flashcards: ${unit.title} · UniTute` : "UniTute" };
}

export default async function FlashcardsPage({ params }: PageProps<"/course/[courseId]/unit/[unitId]/flashcards">) {
  const { courseId, unitId } = await params;
  const unit = (await getCourse(courseId))?.course.units.find((u) => u.id === unitId);
  if (!unit) notFound();

  const cards = unit.lessons.flatMap((lesson) =>
    lesson.flashcards.map((c) => ({
      lesson: lesson.title,
      front: <Markdown>{c.front}</Markdown>,
      back: <Markdown>{c.back}</Markdown>,
    })),
  );

  return (
    <article className="mx-auto max-w-[640px] px-4 pb-24 pt-6 sm:px-6 sm:pt-10">
      <p className="text-sm text-muted">
        {unit.week !== null && <>Week {unit.week} · </>}
        {unit.title}
      </p>
      <h1 className="mt-2 font-display text-3xl font-medium tracking-tight">Flashcards</h1>
      <div className="mt-8">
        {cards.length ? <FlashcardDeck cards={cards} /> : <p className="text-muted">No flashcards for this unit yet.</p>}
      </div>
    </article>
  );
}
