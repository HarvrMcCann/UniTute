import { describe, expect, it } from "vitest";
import sample from "@/content/sample-course.json";
import { courseSchema } from "@/lib/course/schema";
import { assembleCourse, buildLesson, planFromOutline, shuffleOptions, slugify, type CoursePlan } from "@/lib/generation/assemble";
import { lessonToDraft } from "@/lib/generation/examples";
import type { LessonContent, Outline } from "@/lib/generation/schemas";

const course = courseSchema.parse(sample);

/** An outline shaped like Claude's, built from the sample course. */
const outline: Outline = {
  title: course.title,
  summary: course.summary,
  concepts: course.concepts.map((c) => ({ key: c.id.slice(2), name: c.name, description: c.description })),
  units: course.units.map((u) => ({
    title: u.title,
    summary: u.summary,
    week: u.week,
    lessons: u.lessons.map((l) => ({
      title: l.title,
      summary: l.summary,
      estMinutes: l.estMinutes,
      conceptKeys: l.conceptIds.map((c) => c.slice(2)),
      sourceFileIds: ["file-1", "not-a-real-file"],
      plan: "Teach it.",
    })),
  })),
};

const opts = { courseId: "course-1", lengthMode: "recommended" as const, knownFileIds: new Set(["file-1"]), fallbackTitle: "X" };

describe("slugify", () => {
  it("makes URL-safe slugs", () => {
    expect(slugify("Bode Plots & Decibels!")).toBe("bode-plots-decibels");
    expect(slugify("Ωmega ∑")).toBe("mega");
    expect(slugify("!!!")).toBe("x");
  });
});

describe("planFromOutline", () => {
  const plan = planFromOutline(outline, opts);

  it("assigns prefixed unique ids and keeps known files only", () => {
    const lessons = plan.units.flatMap((u) => u.lessons);
    expect(new Set(lessons.map((l) => l.id)).size).toBe(lessons.length);
    expect(lessons.every((l) => l.id.startsWith("l-"))).toBe(true);
    expect(plan.units.every((u) => u.id.startsWith("u-"))).toBe(true);
    expect(lessons[0].sourceFileIds).toEqual(["file-1"]);
    expect(lessons[0].conceptIds).toEqual(course.units[0].lessons[0].conceptIds);
  });

  it("de-duplicates repeated titles", () => {
    const twice = planFromOutline(
      { ...outline, units: [{ ...outline.units[0], lessons: [outline.units[0].lessons[0], outline.units[0].lessons[0]] }] },
      opts,
    );
    const [a, b] = twice.units[0].lessons;
    expect(b.id).toBe(`${a.id}-2`);
  });
});

describe("assembleCourse", () => {
  const plan = planFromOutline(outline, opts);
  const contents: Record<string, LessonContent> = {};
  plan.units.forEach((u, ui) =>
    u.lessons.forEach((l, li) => {
      contents[l.id] = lessonToDraft(course.units[ui].lessons[li]);
    }),
  );

  it("rebuilds the sample course into a valid course with the same content", () => {
    const built = assembleCourse(plan, contents, { courseCode: "ENGR2722" });
    expect(courseSchema.safeParse(built).success).toBe(true);
    const count = (c: typeof built) => c.units.flatMap((u) => u.lessons).map((l) => [l.blocks.length, l.questions.length]);
    expect(count(built)).toEqual(count(course));
  });

  it("repairs slips: unplaced questions, unknown concepts, bad answers", () => {
    const planned = plan.units[0].lessons[0];
    const draft = lessonToDraft(course.units[0].lessons[0]);
    const messy: LessonContent = {
      blocks: draft.blocks.filter((b) => b.type !== "check"), // no checks placed at all
      questions: [
        { ...draft.questions[0], conceptKey: "made-up-concept" },
        { ref: "bad", type: "multipleChoice", conceptKey: "x", prompt: "?", explanation: "", options: ["a", "b"], answerIndex: 5 },
      ],
    };
    const lesson = buildLesson(planned, messy, plan as CoursePlan);
    expect(lesson.questions).toHaveLength(1); // out-of-range answer dropped
    expect(lesson.questions[0].conceptId).toBe(planned.conceptIds[0]); // unknown concept -> lesson's concept
    const checks = lesson.blocks.filter((b) => b.type === "check");
    expect(checks).toHaveLength(1); // placed automatically
    const lastTwo = lesson.blocks.slice(-2).map((b) => b.type);
    expect(lastTwo).toEqual(["check", "summary"]); // just before the summary
  });
});

describe("shuffleOptions", () => {
  it("moves the answer with its option and is stable per seed", () => {
    const options = ["right", "w1", "w2", "w3"];
    const a = shuffleOptions(options, 0, "q-x-1");
    expect(a.options[a.answerIndex]).toBe("right");
    expect(shuffleOptions(options, 0, "q-x-1")).toEqual(a);
    expect([...a.options].sort()).toEqual([...options].sort());
  });

  it("spreads correct answers across positions", () => {
    const positions = new Set(Array.from({ length: 40 }, (_, i) => shuffleOptions(["right", "a", "b", "c"], 0, `q-${i}`).answerIndex));
    expect(positions.size).toBe(4);
  });

  it("leaves options alone when one refers to the others", () => {
    const options = ["x", "y", "Both of the above", "Neither"];
    expect(shuffleOptions(options, 2, "q-1")).toEqual({ options, answerIndex: 2 });
  });
});
