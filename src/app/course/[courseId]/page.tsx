import { notFound, redirect } from "next/navigation";
import { allLessons, getCourse } from "@/lib/course/load";
import { getCourseProgress } from "@/lib/progress";

/** Opens the lesson you were last in (signed in), otherwise the first lesson. */
export default async function CoursePage({ params }: PageProps<"/course/[courseId]">) {
  const { courseId } = await params;
  const loaded = await getCourse(courseId);
  if (!loaded) notFound();

  const progress = await getCourseProgress(loaded);
  const lessonKey = progress.lastVisited ?? allLessons(loaded.course)[0].id;
  redirect(`/course/${courseId}/${lessonKey}`);
}
