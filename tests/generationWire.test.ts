import { describe, expect, it } from "vitest";
import sample from "@/content/sample-course.json";
import { courseSchema } from "@/lib/course/schema";
import { lessonToDraft } from "@/lib/generation/examples";
import { fromWire, lessonWireSchema, parseLessonWire, toWire } from "@/lib/generation/wire";

const course = courseSchema.parse(sample);

describe("lesson wire format", () => {
  it("round-trips every sample lesson exactly", () => {
    for (const lesson of course.units.flatMap((u) => u.lessons)) {
      const content = lessonToDraft(lesson).content;
      const wire = toWire(content);
      expect(lessonWireSchema.safeParse(wire).success, lesson.id).toBe(true);
      expect(fromWire(wire), lesson.id).toEqual(content);
    }
  });

  it("drops blocks missing what their type needs", () => {
    const empty = { text: null, title: null, variant: null, term: null, problem: null, steps: null, answer: null, code: null, language: null, caption: null, questionRef: null, plot: null, brief: null };
    const content = fromWire({
      blocks: [
        { ...empty, type: "definition", text: "no term" },
        { ...empty, type: "plot" },
        { ...empty, type: "text", text: "kept" },
      ],
      questions: [],
      flashcards: [],
      formulas: [],
    });
    expect(content.blocks).toEqual([{ type: "text", markdown: "kept" }]);
  });
});

describe("parseLessonWire", () => {
  const empty = { text: null, title: null, variant: null, term: null, problem: null, steps: null, answer: null, code: null, language: null, caption: null, questionRef: null, plot: null, brief: null };

  it("keeps the good items and drops the bad ones", () => {
    const result = parseLessonWire({
      blocks: [{ ...empty, type: "text", text: "ok" }, { ...empty, type: "table", text: "unknown type" }, "junk"],
      questions: [{ ref: "q1" }],
      flashcards: [{ front: "a", back: "b" }],
      formulas: [],
    });
    expect(result?.lesson.blocks).toHaveLength(1);
    expect(result?.lesson.questions).toHaveLength(0);
    expect(result?.lesson.flashcards).toHaveLength(1);
    expect(result?.dropped).toBe(3);
  });

  it("gives up only when no block is usable", () => {
    expect(parseLessonWire({ blocks: [{ type: "nope" }] })).toBeNull();
    expect(parseLessonWire("nope")).toBeNull();
  });
});
