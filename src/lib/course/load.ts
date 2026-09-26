import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { rowsToCourse, type CourseRow, type CourseRows, type QuestionRow } from "./rows";
import type { Course, Lesson, Unit } from "./schema";

/*
 * Course reads for server components. They use the signed-in user's Supabase client,
 * so row level security decides what's visible (samples to everyone, other courses
 * to their owner).
 */

export type LoadedCourse = {
  course: Course;
  /** Course-JSON lesson key -> database UUID (progress rows reference the UUID). */
  lessonIds: Map<string, string>;
};

type Keyed = { id: string; key: string };

export const getCourse = cache(async (courseId: string): Promise<LoadedCourse | null> => {
  const supabase = await createClient();

  const { data: courseRow } = await supabase
    .from("courses")
    .select("id, owner_id, is_sample, title, summary, university, course_code, year, length_mode, status")
    .eq("id", courseId)
    .maybeSingle<CourseRow>();
  if (!courseRow) return null;

  const [units, lessons, concepts, questions] = await Promise.all([
    supabase.from("units").select("id, key, position, title, summary, week").eq("course_id", courseId),
    supabase
      .from("lessons")
      .select("id, key, unit_id, position, title, summary, est_minutes, blocks")
      .eq("course_id", courseId),
    supabase.from("concepts").select("id, key, name, description").eq("course_id", courseId),
    supabase
      .from("questions")
      .select("key, lesson_id, concept_id, position, type, prompt, options, answer, explanation")
      .eq("course_id", courseId),
  ]);
  for (const r of [units, lessons, concepts, questions]) if (r.error) throw new Error(r.error.message);

  const unitKey = new Map((units.data as Keyed[]).map((u) => [u.id, u.key]));
  const lessonKey = new Map((lessons.data as Keyed[]).map((l) => [l.id, l.key]));
  const conceptKey = new Map((concepts.data as Keyed[]).map((c) => [c.id, c.key]));

  const links = await supabase
    .from("lesson_concepts")
    .select("lesson_id, concept_id, position")
    .in("lesson_id", [...lessonKey.keys()]);
  if (links.error) throw new Error(links.error.message);

  const rows: CourseRows = {
    course: courseRow,
    units: units.data!,
    lessons: lessons.data!.map((l) => ({ ...l, unit_key: unitKey.get(l.unit_id)! })),
    concepts: concepts.data!,
    lessonConcepts: links.data.map((lc) => ({
      lesson_key: lessonKey.get(lc.lesson_id)!,
      concept_key: conceptKey.get(lc.concept_id)!,
      position: lc.position,
    })),
    questions: questions.data!.map((q) => ({
      ...(q as Omit<QuestionRow, "lesson_key" | "concept_key">),
      lesson_key: lessonKey.get(q.lesson_id)!,
      concept_key: conceptKey.get(q.concept_id)!,
    })),
  };

  return {
    course: rowsToCourse(rows),
    lessonIds: new Map([...lessonKey].map(([id, key]) => [key, id])),
  };
});

export type CourseSummary = {
  id: string;
  title: string;
  courseCode: string | null;
  isSample: boolean;
  lessonCount: number;
  minutes: number;
};

export const listCourses = cache(async (): Promise<CourseSummary[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("courses")
    .select("id, title, course_code, is_sample, lessons(est_minutes)")
    .eq("status", "ready")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  return data.map((c) => ({
    id: c.id,
    title: c.title,
    courseCode: c.course_code,
    isSample: c.is_sample,
    lessonCount: c.lessons.length,
    minutes: c.lessons.reduce((sum: number, l: { est_minutes: number }) => sum + l.est_minutes, 0),
  }));
});

// ---------- Pure helpers over a loaded course ----------

export type LessonLocation = {
  unit: Unit;
  lesson: Lesson;
  prev: Lesson | null;
  next: Lesson | null;
  /** 1-based position of the lesson across the whole course. */
  number: number;
  total: number;
};

export function allLessons(course: Course): Lesson[] {
  return course.units.flatMap((u) => u.lessons);
}

export function locateLesson(course: Course, lessonId: string): LessonLocation | null {
  const lessons = allLessons(course);
  const index = lessons.findIndex((l) => l.id === lessonId);
  if (index === -1) return null;
  const unit = course.units.find((u) => u.lessons.some((l) => l.id === lessonId))!;
  return {
    unit,
    lesson: lessons[index],
    prev: lessons[index - 1] ?? null,
    next: lessons[index + 1] ?? null,
    number: index + 1,
    total: lessons.length,
  };
}

/** Curriculum without lesson content, small enough to send to client components. */
export type CourseOutline = {
  id: string;
  title: string;
  courseCode?: string;
  units: {
    id: string;
    title: string;
    week: number | null;
    lessons: { id: string; title: string; estMinutes: number }[];
  }[];
};

export function outlineOf(course: Course): CourseOutline {
  return {
    id: course.id,
    title: course.title,
    courseCode: course.courseCode,
    units: course.units.map((u) => ({
      id: u.id,
      title: u.title,
      week: u.week,
      lessons: u.lessons.map((l) => ({ id: l.id, title: l.title, estMinutes: l.estMinutes })),
    })),
  };
}
