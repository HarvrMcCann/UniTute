import { describe, expect, it } from "vitest";
import { formatTick, formatValue, logTicks, niceTicks, normalise, samples } from "@/lib/plot/axes";

describe("plot axes", () => {
  it("normalises linear and log values", () => {
    expect(normalise(5, 0, 10, "linear")).toBe(0.5);
    expect(normalise(100, 1, 10_000, "log")).toBeCloseTo(0.5);
  });

  it("samples evenly, log-spaced on log axes", () => {
    expect(samples(0, 1, "linear", 3)).toEqual([0, 0.5, 1]);
    const log = samples(1, 100, "log", 3);
    expect(log[1]).toBeCloseTo(10);
  });

  it("picks nice ticks", () => {
    expect(niceTicks(0, 10)).toEqual([0, 2, 4, 6, 8, 10]);
    expect(niceTicks(-60, 10)).toEqual([-60, -50, -40, -30, -20, -10, 0, 10]);
    expect(niceTicks(-0.3, 0.3)).toContain(0);
    expect(logTicks(0.5, 2000)).toEqual([1, 10, 100, 1000]);
  });

  it("formats ticks and values readably", () => {
    expect(formatTick(1000)).toBe("1k");
    expect(formatTick(0.001)).toBe("0.001");
    expect(formatTick(1e-6)).toBe("1e-6");
    expect(formatTick(2_000_000)).toBe("2M");
    expect(formatValue(0.00123, 0.0001)).toBe("0.0012");
    expect(formatValue(Number.NaN)).toBe("–");
  });
});
