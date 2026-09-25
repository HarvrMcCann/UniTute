import sampleCourseJson from "@/content/sample-course.json";
import { courseSchema, type Course, type Lesson, type Unit } from "./schema";

// Phase 2: courses come from bundled JSON. Phase 3 swaps this for Supabase.
const courses: Course[] = [courseSchema.parse(sampleCourseJson)];

export function listCourses(): Course[] {
  return courses;
}

export function getCourse(courseId: string): Course | null {
  return courses.find((c) => c.id === courseId) ?? null;
}

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
