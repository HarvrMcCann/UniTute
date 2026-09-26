import "server-only";
import { cache } from "react";
import type { LoadedCourse } from "@/lib/course/load";
import { createClient, getUser } from "@/lib/supabase/server";

export type LessonProgress = { lastBlockId: string | null; completed: boolean };

export type CourseProgress = {
  /** Keyed by course-JSON lesson key. `completed` = scrolled to the end of the lesson. */
  byLesson: Map<string, LessonProgress>;
  /** Lesson key the learner opened most recently, if any. */
  lastVisited: string | null;
  /** Question keys the learner has finished at least once. */
  answered: Set<string>;
};

const EMPTY: CourseProgress = { byLesson: new Map(), lastVisited: null, answered: new Set() };

/** The signed-in user's progress in one course (empty when signed out). */
export const getCourseProgress = cache(async (loaded: LoadedCourse): Promise<CourseProgress> => {
  const user = await getUser();
  if (!user) return EMPTY;

  const supabase = await createClient();
  const [progress, attempts] = await Promise.all([
    supabase
      .from("lesson_progress")
      .select("lesson_id, last_block_id, completed_at, updated_at")
      .eq("user_id", user.id)
      .eq("course_id", loaded.course.id)
      .order("updated_at", { ascending: false }),
    supabase
      .from("attempts")
      .select("question_id")
      .eq("user_id", user.id)
      .in("question_id", [...loaded.questionIds.values()]),
  ]);
  if (progress.error) throw new Error(progress.error.message);
  if (attempts.error) throw new Error(attempts.error.message);

  const lessonKeyOf = new Map([...loaded.lessonIds].map(([key, id]) => [id, key]));
  const byLesson = new Map<string, LessonProgress>();
  for (const row of progress.data) {
    const key = lessonKeyOf.get(row.lesson_id);
    if (key) byLesson.set(key, { lastBlockId: row.last_block_id, completed: row.completed_at !== null });
  }
  const lastVisited = progress.data.map((row) => lessonKeyOf.get(row.lesson_id)).find(Boolean) ?? null;

  const questionKeyOf = new Map([...loaded.questionIds].map(([key, id]) => [id, key]));
  const answered = new Set(attempts.data.map((a) => questionKeyOf.get(a.question_id)).filter((k) => k !== undefined));

  return { byLesson, lastVisited, answered };
});

export type ContinuePoint = { courseId: string; lessonKey: string; lessonTitle: string };

/** Most recently opened lesson in each course, for "Continue" links on the home page. */
export const getContinuePoints = cache(async (): Promise<Map<string, ContinuePoint>> => {
  const user = await getUser();
  if (!user) return new Map();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lesson_progress")
    .select("course_id, updated_at, lessons(key, title)")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);

  const points = new Map<string, ContinuePoint>();
  for (const row of data) {
    const lesson = row.lessons as unknown as { key: string; title: string } | null;
    if (lesson && !points.has(row.course_id)) {
      points.set(row.course_id, { courseId: row.course_id, lessonKey: lesson.key, lessonTitle: lesson.title });
    }
  }
  return points;
});
