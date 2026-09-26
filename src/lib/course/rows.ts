import { courseSchema, type Block, type Course, type Question } from "./schema";

/*
 * Mapping between the course JSON document and database rows (snake_case).
 * Pure functions only, so they're unit-testable and usable from scripts and jobs.
 * Rows reference each other by course-JSON key here; save.ts resolves keys to UUIDs.
 */

export type CourseMeta = {
  ownerId: string | null;
  isSample: boolean;
  status: "draft" | "extracting" | "generating" | "ready" | "failed";
};

export type CourseRow = {
  id: string;
  owner_id: string | null;
  is_sample: boolean;
  title: string;
  summary: string;
  university: string | null;
  course_code: string | null;
  year: number | null;
  length_mode: Course["lengthMode"];
  status: CourseMeta["status"];
};

export type UnitRow = { key: string; position: number; title: string; summary: string; week: number | null };
export type LessonRow = {
  key: string;
  unit_key: string;
  position: number;
  title: string;
  summary: string;
  est_minutes: number;
  blocks: Block[];
};
export type ConceptRow = { key: string; name: string; description: string };
export type LessonConceptRow = { lesson_key: string; concept_key: string; position: number };
export type QuestionRow = {
  key: string;
  lesson_key: string;
  concept_key: string;
  position: number;
  type: Question["type"];
  prompt: string;
  options: string[] | null;
  answer: { index: number } | { modelAnswer: string; markingGuide: string } | null;
  explanation: string;
};

export type CourseRows = {
  course: CourseRow;
  units: UnitRow[];
  lessons: LessonRow[];
  concepts: ConceptRow[];
  lessonConcepts: LessonConceptRow[];
  questions: QuestionRow[];
};

export function courseToRows(course: Course, meta: CourseMeta): CourseRows {
  const rows: CourseRows = {
    course: {
      id: course.id,
      owner_id: meta.ownerId,
      is_sample: meta.isSample,
      title: course.title,
      summary: course.summary,
      university: course.university ?? null,
      course_code: course.courseCode ?? null,
      year: course.year ?? null,
      length_mode: course.lengthMode,
      status: meta.status,
    },
    units: [],
    lessons: [],
    concepts: course.concepts.map((c) => ({ key: c.id, name: c.name, description: c.description })),
    lessonConcepts: [],
    questions: [],
  };

  course.units.forEach((unit, u) => {
    rows.units.push({ key: unit.id, position: u, title: unit.title, summary: unit.summary, week: unit.week });
    unit.lessons.forEach((lesson, l) => {
      rows.lessons.push({
        key: lesson.id,
        unit_key: unit.id,
        position: l,
        title: lesson.title,
        summary: lesson.summary,
        est_minutes: lesson.estMinutes,
        blocks: lesson.blocks,
      });
      lesson.conceptIds.forEach((conceptKey, position) =>
        rows.lessonConcepts.push({ lesson_key: lesson.id, concept_key: conceptKey, position }),
      );
      lesson.questions.forEach((q, position) => rows.questions.push(questionToRow(q, lesson.id, position)));
    });
  });

  return rows;
}

function questionToRow(q: Question, lessonKey: string, position: number): QuestionRow {
  const base = {
    key: q.id,
    lesson_key: lessonKey,
    concept_key: q.conceptId,
    position,
    type: q.type,
    prompt: q.prompt,
    explanation: q.explanation,
  };
  switch (q.type) {
    case "multipleChoice":
      return { ...base, options: q.options, answer: { index: q.answerIndex } };
    case "shortAnswer":
      return { ...base, options: null, answer: { modelAnswer: q.modelAnswer, markingGuide: q.markingGuide } };
    case "ordering":
      return { ...base, options: q.items, answer: null };
  }
}

function rowToQuestion(row: QuestionRow): Question {
  const base = { id: row.key, conceptId: row.concept_key, prompt: row.prompt, explanation: row.explanation };
  switch (row.type) {
    case "multipleChoice":
      return { ...base, type: "multipleChoice", options: row.options ?? [], answerIndex: (row.answer as { index: number }).index };
    case "shortAnswer": {
      const answer = row.answer as { modelAnswer: string; markingGuide: string };
      return { ...base, type: "shortAnswer", modelAnswer: answer.modelAnswer, markingGuide: answer.markingGuide };
    }
    case "ordering":
      return { ...base, type: "ordering", items: row.options ?? [] };
  }
}

const byPosition = (a: { position: number }, b: { position: number }) => a.position - b.position;

/** Rebuilds (and validates) the course document from its rows. */
export function rowsToCourse(rows: CourseRows): Course {
  const lessonsByUnit = Map.groupBy([...rows.lessons].sort(byPosition), (l) => l.unit_key);
  const conceptsByLesson = Map.groupBy([...rows.lessonConcepts].sort(byPosition), (lc) => lc.lesson_key);
  const questionsByLesson = Map.groupBy([...rows.questions].sort(byPosition), (q) => q.lesson_key);
  const c = rows.course;

  return courseSchema.parse({
    schemaVersion: 1,
    id: c.id,
    title: c.title,
    ...(c.university !== null && { university: c.university }),
    ...(c.course_code !== null && { courseCode: c.course_code }),
    ...(c.year !== null && { year: c.year }),
    lengthMode: c.length_mode,
    summary: c.summary,
    concepts: rows.concepts.map((r) => ({ id: r.key, name: r.name, description: r.description })),
    units: [...rows.units].sort(byPosition).map((unit) => ({
      id: unit.key,
      title: unit.title,
      summary: unit.summary,
      week: unit.week,
      lessons: (lessonsByUnit.get(unit.key) ?? []).map((lesson) => ({
        id: lesson.key,
        title: lesson.title,
        summary: lesson.summary,
        estMinutes: lesson.est_minutes,
        conceptIds: (conceptsByLesson.get(lesson.key) ?? []).map((lc) => lc.concept_key),
        blocks: lesson.blocks,
        questions: (questionsByLesson.get(lesson.key) ?? []).map(rowToQuestion),
      })),
    })),
  });
}
