import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LessonView } from "@/components/classroom/LessonView";
import { allLessons, getCourse, listCourses, locateLesson } from "@/lib/course/load";

export function generateStaticParams() {
  return listCourses().flatMap((course) =>
    allLessons(course).map((lesson) => ({ courseId: course.id, lessonId: lesson.id })),
  );
}

export async function generateMetadata({ params }: PageProps<"/course/[courseId]/[lessonId]">): Promise<Metadata> {
  const { courseId, lessonId } = await params;
  const course = getCourse(courseId);
  const location = course && locateLesson(course, lessonId);
  return { title: location ? `${location.lesson.title} · UniTute` : "UniTute" };
}

export default async function LessonPage({ params }: PageProps<"/course/[courseId]/[lessonId]">) {
  const { courseId, lessonId } = await params;
  const course = getCourse(courseId);
  const location = course && locateLesson(course, lessonId);
  if (!course || !location) notFound();

  return <LessonView course={course} location={location} />;
}
