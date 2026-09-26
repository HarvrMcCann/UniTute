import { describe, expect, it } from "vitest";
import sample from "@/content/sample-course.json";
import { courseToRows, rowsToCourse } from "@/lib/course/rows";
import { courseSchema } from "@/lib/course/schema";
import { safeNext } from "@/lib/safeNext";

const course = courseSchema.parse(sample);
const meta = { ownerId: null, isSample: true, status: "ready" as const };

describe("course <-> rows", () => {
  it("round-trips the sample course exactly", () => {
    expect(rowsToCourse(courseToRows(course, meta))).toEqual(course);
  });

  it("rebuilds order from positions, not row order", () => {
    const rows = courseToRows(course, meta);
    rows.units.reverse();
    rows.lessons.reverse();
    rows.questions.reverse();
    rows.lessonConcepts.reverse();
    expect(rowsToCourse(rows)).toEqual(course);
  });

  it("stores each question type's answer in the right columns", () => {
    const { questions } = courseToRows(course, meta);
    const byType = (t: string) => questions.find((q) => q.type === t)!;
    expect(byType("multipleChoice").answer).toEqual({ index: expect.any(Number) });
    expect(byType("shortAnswer").answer).toHaveProperty("markingGuide");
    expect(byType("ordering").options?.length).toBeGreaterThan(1);
  });
});

describe("safeNext", () => {
  it("keeps same-site paths", () => {
    expect(safeNext("/course/x/l-y")).toBe("/course/x/l-y");
  });

  it("rejects anything that could leave the site", () => {
    for (const bad of ["https://evil.com", "//evil.com", "/\\evil.com", "evil", "", null, undefined]) {
      expect(safeNext(bad)).toBe("/");
    }
  });
});
