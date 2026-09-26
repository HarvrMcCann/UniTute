import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LessonView } from "@/components/classroom/LessonView";
import { getCourse, locateLesson } from "@/lib/course/load";
import { getCourseProgress } from "@/lib/progress";

export async function generateMetadata({ params }: PageProps<"/course/[courseId]/[lessonId]">): Promise<Metadata> {
  const { courseId, lessonId } = await params;
  const loaded = await getCourse(courseId);
  const location = loaded && locateLesson(loaded.course, lessonId);
  return { title: location ? `${location.lesson.title} · UniTute` : "UniTute" };
}

export default async function LessonPage({ params }: PageProps<"/course/[courseId]/[lessonId]">) {
  const { courseId, lessonId } = await params;
  const loaded = await getCourse(courseId);
  const location = loaded && locateLesson(loaded.course, lessonId);
  if (!loaded || !location) notFound();

  const progress = await getCourseProgress(courseId, loaded.lessonIds);
  const saved = progress.byLesson.get(lessonId);
  // Finished lessons reopen at the top; unfinished ones where you left off.
  const firstBlockId = location.lesson.blocks[0].id;
  const resumeBlockId =
    saved && !saved.completed && saved.lastBlockId && saved.lastBlockId !== firstBlockId ? saved.lastBlockId : null;

  return (
    <LessonView
      course={loaded.course}
      location={location}
      lessonDbId={loaded.lessonIds.get(lessonId)!}
      resumeBlockId={resumeBlockId}
    />
  );
}
