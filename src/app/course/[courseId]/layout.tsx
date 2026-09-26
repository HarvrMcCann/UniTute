import { notFound } from "next/navigation";
import { ClassroomShell } from "@/components/classroom/ClassroomShell";
import { ProgressProvider } from "@/components/classroom/ProgressContext";
import { allLessons, getCourse, outlineOf } from "@/lib/course/load";
import { getCourseProgress } from "@/lib/progress";
import { getProfile, getUser } from "@/lib/supabase/server";

export default async function CourseLayout({ children, params }: LayoutProps<"/course/[courseId]">) {
  const { courseId } = await params;
  const loaded = await getCourse(courseId);
  if (!loaded) notFound();

  const [user, profile, progress] = await Promise.all([
    getUser(),
    getProfile(),
    getCourseProgress(loaded),
  ]);
  const scrolled = [...progress.byLesson].filter(([, p]) => p.completed).map(([key]) => key);
  const lessonQuestions = Object.fromEntries(
    allLessons(loaded.course).map((l) => [l.id, l.questions.map((q) => q.id)]),
  );

  return (
    <ProgressProvider
      userId={user?.id ?? null}
      initialScrolled={scrolled}
      initialAnswered={[...progress.answered]}
      lessonQuestions={lessonQuestions}
    >
      <ClassroomShell
        outline={outlineOf(loaded.course)}
        account={user ? { email: user.email, displayName: profile?.displayName ?? null } : null}
      >
        {children}
      </ClassroomShell>
    </ProgressProvider>
  );
}
