import { notFound } from "next/navigation";
import { ClassroomShell } from "@/components/classroom/ClassroomShell";
import { ProgressProvider } from "@/components/classroom/ProgressContext";
import { getCourse, outlineOf } from "@/lib/course/load";
import { getCourseProgress } from "@/lib/progress";
import { getProfile, getUser } from "@/lib/supabase/server";

export default async function CourseLayout({ children, params }: LayoutProps<"/course/[courseId]">) {
  const { courseId } = await params;
  const loaded = await getCourse(courseId);
  if (!loaded) notFound();

  const [user, profile, progress] = await Promise.all([
    getUser(),
    getProfile(),
    getCourseProgress(courseId, loaded.lessonIds),
  ]);
  const completed = [...progress.byLesson].filter(([, p]) => p.completed).map(([key]) => key);

  return (
    <ProgressProvider userId={user?.id ?? null} initialCompleted={completed}>
      <ClassroomShell
        outline={outlineOf(loaded.course)}
        account={user ? { email: user.email, displayName: profile?.displayName ?? null } : null}
      >
        {children}
      </ClassroomShell>
    </ProgressProvider>
  );
}
