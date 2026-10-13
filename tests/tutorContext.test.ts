import { describe, expect, it } from "vitest";
import sample from "@/content/sample-course.json";
import { courseSchema } from "@/lib/course/schema";
import { blockLabel, courseMap, knowledgeLevel, lessonContext } from "@/lib/tutor/context";

const course = courseSchema.parse(sample);
const lesson = course.units[0].lessons[0];

describe("tutor context", () => {
  it("tags every block of the lesson with its ID", () => {
    const text = lessonContext(lesson);
    for (const block of lesson.blocks) expect(text).toContain(`[${block.id}]`);
    expect(text.startsWith(`Lesson: ${lesson.title}`)).toBe(true);
  });

  it("gives every block type a short label", () => {
    const questions = new Map(course.units.flatMap((u) => u.lessons).flatMap((l) => l.questions).map((q) => [q.id, q]));
    for (const block of course.units.flatMap((u) => u.lessons).flatMap((l) => l.blocks)) {
      const label = blockLabel(block, questions);
      expect(label.length).toBeGreaterThan(0);
      expect(label.length).toBeLessThanOrEqual(80);
    }
  });

  it("lists every lesson in the course map", () => {
    const map = courseMap(course);
    for (const l of course.units.flatMap((u) => u.lessons)) expect(map).toContain(l.title);
  });

  it("describes the knowledge level per concept", () => {
    const [first] = lesson.conceptIds;
    const text = knowledgeLevel(course, lesson, { [first]: { score: 0.72, attempts: 8, override: null } });
    const name = course.concepts.find((c) => c.id === first)!.name;
    expect(text).toContain(`${name}: 0.72 (8 answers)`);
    expect(text).toContain("not tested yet");
  });
});
