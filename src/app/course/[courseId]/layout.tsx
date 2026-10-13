import { notFound } from "next/navigation";
import { ClassroomShell } from "@/components/classroom/ClassroomShell";
import { ProgressProvider } from "@/components/classroom/ProgressContext";
import { allLessons, getCourse, outlineOf } from "@/lib/course/load";
import { getCourseProgress } from "@/lib/progress";
import { createClient, getProfile, getUser } from "@/lib/supabase/server";

/** Sharing details for the course's owner (RLS: only they can read members and reports). */
async function getOwnerInfo(courseId: string) {
  const supabase = await createClient();
  const [course, members, reports] = await Promise.all([
    supabase.from("courses").select("share_token").eq("id", courseId).maybeSingle(),
    supabase.from("course_members").select("user_id", { count: "exact", head: true }).eq("course_id", courseId),
    supabase.from("bug_reports").select("id", { count: "exact", head: true }).eq("course_id", courseId),
  ]);
  return { shareToken: course.data?.share_token ?? null, memberCount: members.count ?? 0, reportCount: reports.count ?? 0 };
}

export default async function CourseLayout({ children, params }: LayoutProps<"/course/[courseId]">) {
  const { courseId } = await params;
  const loaded = await getCourse(courseId);
  if (!loaded) notFound();

  const [user, profile, progress] = await Promise.all([
    getUser(),
    getProfile(),
    getCourseProgress(loaded),
  ]);
  const owner = user && user.id === loaded.ownerId ? await getOwnerInfo(courseId) : null;
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
      initialMastery={progress.mastery}
      initialCredit={progress.credit}
    >
      <ClassroomShell
        outline={outlineOf(loaded.course)}
        account={user ? { email: user.email, displayName: profile?.displayName ?? null } : null}
        owner={owner}
      >
        {children}
      </ClassroomShell>
    </ProgressProvider>
  );
}
