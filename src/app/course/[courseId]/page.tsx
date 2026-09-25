import { notFound, redirect } from "next/navigation";
import { allLessons, getCourse } from "@/lib/course/load";

// Phase 3 will resume at the last-visited lesson instead of the first.
export default async function CoursePage({ params }: PageProps<"/course/[courseId]">) {
  const { courseId } = await params;
  const course = getCourse(courseId);
  if (!course) notFound();

  redirect(`/course/${course.id}/${allLessons(course)[0].id}`);
}
