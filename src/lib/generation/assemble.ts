import { courseSchema, type Block, type Course, type Lesson, type Question } from "@/lib/course/schema";
import type { LessonContent, LessonQuestionDraft, Outline } from "./schemas";

/*
 * Turns Claude's outline + per-lesson content into a valid Course. Our code owns every
 * ID (stable, prefixed, unique), repairs small slips (unknown concept keys, a question
 * never placed in a check block, an out-of-range answer) and drops what can't be repaired,
 * so the result always passes courseSchema. Pure functions: unit-tested.
 */

export type LengthMode = Course["lengthMode"];

export type PlannedLesson = {
  id: string;
  title: string;
  summary: string;
  estMinutes: number;
  conceptIds: string[];
  sourceFileIds: string[];
  plan: string;
};

export type PlannedUnit = { id: string; title: string; summary: string; week: number | null; lessons: PlannedLesson[] };

export type CoursePlan = {
  courseId: string;
  title: string;
  summary: string;
  lengthMode: LengthMode;
  concepts: { id: string; name: string; description: string }[];
  units: PlannedUnit[];
};

export function slugify(text: string, max = 40): string {
  const slug = text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/g, "");
  return slug || "x";
}

/** Returns a function that makes `prefix-slug` IDs unique by adding -2, -3, ... */
function uniqueIds() {
  const used = new Set<string>();
  return (candidate: string) => {
    let id = candidate;
    for (let n = 2; used.has(id); n++) id = `${candidate}-${n}`;
    used.add(id);
    return id;
  };
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(n)));

export function planFromOutline(
  outline: Outline,
  opts: { courseId: string; lengthMode: LengthMode; knownFileIds: Set<string>; fallbackTitle: string },
): CoursePlan {
  const conceptId = uniqueIds();
  const conceptByKey = new Map<string, string>();
  const concepts = outline.concepts
    .filter((c) => c.name.trim())
    .map((c) => {
      const id = conceptId(`c-${slugify(c.key || c.name)}`);
      conceptByKey.set(c.key, id);
      conceptByKey.set(slugify(c.key), id);
      return { id, name: c.name.trim(), description: c.description.trim() || c.name.trim() };
    });

  const unitId = uniqueIds();
  const lessonId = uniqueIds();
  const units = outline.units
    .map((u, i): PlannedUnit => ({
      id: unitId(`u-${i + 1}-${slugify(u.title, 30)}`),
      title: u.title.trim() || `Part ${i + 1}`,
      summary: u.summary.trim() || u.title.trim(),
      week: u.week !== null && u.week >= 1 && u.week <= 52 ? u.week : null,
      lessons: u.lessons
        .filter((l) => l.title.trim())
        .map((l) => ({
          id: lessonId(`l-${slugify(l.title)}`),
          title: l.title.trim(),
          summary: l.summary.trim() || l.title.trim(),
          estMinutes: clamp(l.estMinutes || 10, 3, 60),
          conceptIds: [
            ...new Set(l.conceptKeys.map((k) => conceptByKey.get(k) ?? conceptByKey.get(slugify(k))).filter((id) => id !== undefined)),
          ],
          sourceFileIds: l.sourceFileIds.filter((id) => opts.knownFileIds.has(id)),
          plan: l.plan.trim(),
        })),
    }))
    .filter((u) => u.lessons.length > 0);

  if (units.length === 0) throw new Error("The outline had no lessons");

  return {
    courseId: opts.courseId,
    title: outline.title.trim() || opts.fallbackTitle,
    summary: outline.summary.trim() || outline.title.trim() || opts.fallbackTitle,
    lengthMode: opts.lengthMode,
    concepts,
    units,
  };
}

const nonEmpty = (s: string | null | undefined): s is string => typeof s === "string" && s.trim().length > 0;

/** Builds one lesson from Claude's draft content, with IDs derived from the lesson ID. */
export function buildLesson(planned: PlannedLesson, content: LessonContent, plan: CoursePlan): Lesson {
  const stem = planned.id.slice(2); // "l-bode-plots" -> "bode-plots"
  const knownConcepts = new Set(plan.concepts.map((c) => c.id));
  const conceptBySlug = new Map(plan.concepts.map((c) => [c.id.slice(2), c.id]));
  const fallbackConcept = planned.conceptIds[0] ?? plan.concepts[0]?.id;
  const resolveConcept = (key: string) => {
    const direct = key.startsWith("c-") && knownConcepts.has(key) ? key : conceptBySlug.get(slugify(key));
    return direct ?? fallbackConcept;
  };

  // Questions first, so check blocks can point at them.
  const questions: Question[] = [];
  const idByRef = new Map<string, string>();
  for (const draft of content.questions) {
    const conceptId = resolveConcept(draft.conceptKey);
    const question = conceptId ? toQuestion(draft, `q-${stem}-${questions.length + 1}`, conceptId) : null;
    if (!question || idByRef.has(draft.ref)) continue;
    idByRef.set(draft.ref, question.id);
    questions.push(question);
  }

  const blocks: Block[] = [];
  const placed = new Set<string>();
  const blockId = () => `b-${stem}-${blocks.length + 1}`;
  for (const draft of content.blocks) {
    const id = blockId();
    switch (draft.type) {
      case "text":
        if (nonEmpty(draft.markdown)) blocks.push({ id, type: "text", markdown: draft.markdown });
        break;
      case "heading":
        if (nonEmpty(draft.text)) blocks.push({ id, type: "heading", text: draft.text.trim() });
        break;
      case "callout":
        if (nonEmpty(draft.markdown))
          blocks.push({
            id,
            type: "callout",
            variant: draft.variant,
            markdown: draft.markdown,
            ...(nonEmpty(draft.title) && { title: draft.title.trim() }),
          });
        break;
      case "definition":
        if (nonEmpty(draft.term) && nonEmpty(draft.markdown))
          blocks.push({ id, type: "definition", term: draft.term.trim(), markdown: draft.markdown });
        break;
      case "workedExample": {
        const steps = draft.steps.filter(nonEmpty);
        if (nonEmpty(draft.problem) && nonEmpty(draft.answer) && steps.length > 0)
          blocks.push({ id, type: "workedExample", problem: draft.problem, steps, answer: draft.answer });
        break;
      }
      case "code":
        if (nonEmpty(draft.code))
          blocks.push({
            id,
            type: "code",
            language: draft.language.trim() || "text",
            code: draft.code,
            ...(nonEmpty(draft.caption) && { caption: draft.caption.trim() }),
          });
        break;
      case "math":
        if (nonEmpty(draft.latex))
          blocks.push({ id, type: "math", latex: draft.latex.trim(), ...(nonEmpty(draft.caption) && { caption: draft.caption.trim() }) });
        break;
      case "summary": {
        const points = draft.points.filter(nonEmpty);
        if (points.length > 0) blocks.push({ id, type: "summary", points });
        break;
      }
      case "check": {
        const questionId = idByRef.get(draft.questionRef);
        if (questionId && !placed.has(questionId)) {
          placed.add(questionId);
          blocks.push({ id, type: "check", questionId });
        }
        break;
      }
    }
  }

  // Any question Claude forgot to place goes just before the closing summary.
  const unplaced = questions.filter((q) => !placed.has(q.id));
  if (unplaced.length > 0) {
    const summaryAt = blocks.findLastIndex((b) => b.type === "summary");
    const at = summaryAt === -1 ? blocks.length : summaryAt;
    blocks.splice(at, 0, ...unplaced.map((q, i): Block => ({ id: `b-${stem}-extra-${i + 1}`, type: "check", questionId: q.id })));
  }

  if (blocks.length === 0) throw new Error(`Lesson "${planned.title}" came back empty`);

  return {
    id: planned.id,
    title: planned.title,
    summary: planned.summary,
    estMinutes: planned.estMinutes,
    conceptIds: planned.conceptIds,
    blocks,
    questions,
  };
}

function toQuestion(draft: LessonQuestionDraft, id: string, conceptId: string): Question | null {
  if (!nonEmpty(draft.prompt)) return null;
  const base = { id, conceptId, prompt: draft.prompt, explanation: nonEmpty(draft.explanation) ? draft.explanation : "See the lesson above." };
  switch (draft.type) {
    case "multipleChoice": {
      const options = draft.options.filter(nonEmpty).slice(0, 6);
      if (options.length < 2 || draft.answerIndex < 0 || draft.answerIndex >= options.length) return null;
      if (options.length !== draft.options.length) return null; // an option was blank: the index may be off
      return { ...base, type: "multipleChoice", options, answerIndex: draft.answerIndex };
    }
    case "shortAnswer":
      if (!nonEmpty(draft.modelAnswer)) return null;
      return {
        ...base,
        type: "shortAnswer",
        modelAnswer: draft.modelAnswer,
        markingGuide: nonEmpty(draft.markingGuide) ? draft.markingGuide : draft.modelAnswer,
      };
    case "ordering": {
      const items = draft.items.filter(nonEmpty).slice(0, 8);
      if (items.length < 2 || new Set(items).size !== items.length) return null;
      return { ...base, type: "ordering", items };
    }
  }
}

/** Puts the whole course together and validates it; throws with details if anything is off. */
export function assembleCourse(plan: CoursePlan, contents: Record<string, LessonContent>, meta: { university?: string; courseCode?: string; year?: number }): Course {
  const usedConcepts = new Set<string>();
  const units = plan.units.map((unit) => ({
    id: unit.id,
    title: unit.title,
    summary: unit.summary,
    week: unit.week,
    lessons: unit.lessons.map((planned) => {
      const content = contents[planned.id];
      if (!content) throw new Error(`Missing content for lesson ${planned.id}`);
      const lesson = buildLesson(planned, content, plan);
      lesson.conceptIds.forEach((c) => usedConcepts.add(c));
      lesson.questions.forEach((q) => usedConcepts.add(q.conceptId));
      return lesson;
    }),
  }));

  return courseSchema.parse({
    schemaVersion: 1,
    id: plan.courseId,
    title: plan.title,
    ...(meta.university && { university: meta.university }),
    ...(meta.courseCode && { courseCode: meta.courseCode }),
    ...(meta.year && { year: meta.year }),
    lengthMode: plan.lengthMode,
    summary: plan.summary,
    concepts: plan.concepts.filter((c) => usedConcepts.has(c.id)),
    units,
  });
}
