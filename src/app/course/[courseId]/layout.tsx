import { notFound } from "next/navigation";
import { ClassroomShell } from "@/components/classroom/ClassroomShell";
import { getCourse, listCourses, outlineOf } from "@/lib/course/load";

export function generateStaticParams() {
  return listCourses().map((c) => ({ courseId: c.id }));
}

export default async function CourseLayout({ children, params }: LayoutProps<"/course/[courseId]">) {
  const { courseId } = await params;
  const course = getCourse(courseId);
  if (!course) notFound();

  return <ClassroomShell outline={outlineOf(course)}>{children}</ClassroomShell>;
}
