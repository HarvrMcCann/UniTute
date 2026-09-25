import { describe, expect, it } from "vitest";
import sample from "@/content/sample-course.json";
import { courseSchema } from "@/lib/course/schema";
import { seededShuffle } from "@/lib/shuffle";

type LooseCourse = {
  units: {
    id: string;
    lessons: { conceptIds: string[]; blocks: { id: string; type: string; questionId?: string }[] }[];
  }[];
};
const clone = () => structuredClone(sample) as unknown as LooseCourse;

function issues(data: unknown): string[] {
  const result = courseSchema.safeParse(data);
  return result.success ? [] : result.error.issues.map((i) => i.message);
}

describe("course schema", () => {
  it("accepts the sample course", () => {
    expect(issues(sample)).toEqual([]);
  });

  it("rejects duplicate ids", () => {
    const course = clone();
    course.units[1].lessons[0].blocks[0].id = course.units[0].lessons[0].blocks[0].id;
    expect(issues(course)).toContainEqual(expect.stringContaining("duplicate id"));
  });

  it("rejects unknown concepts", () => {
    const course = clone();
    course.units[0].lessons[0].conceptIds.push("c-nope");
    expect(issues(course)).toContainEqual('unknown concept "c-nope"');
  });

  it("rejects a question that is never placed", () => {
    const course = clone();
    const lesson = course.units[0].lessons[0];
    lesson.blocks = lesson.blocks.filter((b) => b.type !== "check");
    expect(issues(course)).toContainEqual(expect.stringContaining("exactly one check block"));
  });

  it("rejects a check block pointing at a missing question", () => {
    const course = clone();
    course.units[0].lessons[0].blocks.push({ id: "b-extra", type: "check", questionId: "q-missing" });
    expect(issues(course)).toContainEqual(expect.stringContaining('unknown question "q-missing"'));
  });

  it("rejects badly prefixed ids", () => {
    const course = clone();
    course.units[0].id = "unit1";
    expect(issues(course).length).toBeGreaterThan(0);
  });
});

describe("seededShuffle", () => {
  const items = ["a", "b", "c", "d"];

  it("is deterministic for a seed", () => {
    expect(seededShuffle(items, "q-1")).toEqual(seededShuffle(items, "q-1"));
  });

  it("never returns the original order", () => {
    for (const seed of ["q-1", "q-2", "q-3", "x", "q-fr-steps", "q-so-damping-order"]) {
      expect(seededShuffle(items, seed)).not.toEqual(items);
      expect([...seededShuffle(items, seed)].sort()).toEqual(items);
    }
  });
});
