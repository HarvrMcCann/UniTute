import { describe, expect, it } from "vitest";
import {
  applyAnswer,
  averageScore,
  countsTowardMastery,
  effectiveScore,
  levelOf,
  masterySummaryLine,
  orderingScore,
  RECOUNT_AFTER_MS,
} from "@/lib/mastery";

describe("applyAnswer (PLAN.md formula)", () => {
  it("moves quickly at first, then fine-tunes", () => {
    let m = applyAnswer(null, 1);
    expect(m).toEqual({ score: 0.5, attempts: 1, override: null });
    m = applyAnswer(m, 1);
    expect(m.score).toBeCloseTo(2 / 3);
    m = applyAnswer(m, 0);
    expect(m.score).toBeCloseTo(0.5);
    expect(m.attempts).toBe(3);
  });

  it("gives partial credit", () => {
    expect(applyAnswer(null, 0.5).score).toBeCloseTo(0.25);
  });

  it("starts from the user's override and then clears it", () => {
    const m = applyAnswer({ score: 0.4, attempts: 5, override: 0.8 }, 1);
    expect(m.score).toBeCloseTo(0.8 + 0.2 / 7);
    expect(m.override).toBeNull();
  });

  it("clamps bad input", () => {
    expect(applyAnswer(null, 7).score).toBe(0.5);
    expect(applyAnswer(null, Number.NaN).score).toBe(0);
  });
});

describe("levels", () => {
  it("prefers the override and treats untouched rows as unseen", () => {
    expect(effectiveScore({ score: 0.3, attempts: 2, override: 0.9 })).toBe(0.9);
    expect(effectiveScore({ score: 0, attempts: 0, override: null })).toBeNull();
    expect(effectiveScore(null)).toBeNull();
    expect(levelOf(null)).toBe("unseen");
    expect(levelOf(0.2)).toBe("low");
    expect(levelOf(0.5)).toBe("mid");
    expect(levelOf(0.8)).toBe("high");
  });

  it("averages a lesson with untested concepts counting as 0", () => {
    expect(averageScore([null, null])).toBeNull();
    expect(averageScore([1, null])).toBe(0.5);
    expect(averageScore([])).toBeNull();
  });

  it("summarises for the tutor", () => {
    expect(masterySummaryLine("Big-O", { score: 0.72, attempts: 8, override: null })).toBe("Big-O: 0.72 (8 answers)");
    expect(masterySummaryLine("Big-O", null)).toBe("Big-O: not tested yet");
  });
});

describe("rules", () => {
  it("only recounts a question after a day", () => {
    const now = new Date("2026-09-30T12:00:00Z");
    expect(countsTowardMastery(null, now)).toBe(true);
    expect(countsTowardMastery(new Date(now.getTime() - 60_000), now)).toBe(false);
    expect(countsTowardMastery(new Date(now.getTime() - RECOUNT_AFTER_MS), now)).toBe(true);
  });

  it("scores orderings by neighbouring pairs", () => {
    expect(orderingScore([0, 1, 2, 3])).toBe(1);
    expect(orderingScore([3, 2, 1, 0])).toBe(0);
    expect(orderingScore([1, 0, 2, 3])).toBeCloseTo(2 / 3);
    expect(orderingScore([0])).toBe(1);
  });
});
