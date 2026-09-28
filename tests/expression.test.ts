import { describe, expect, it } from "vitest";
import { compile, ExpressionError } from "@/lib/plot/expression";

const ev = (src: string, vars: Record<string, number> = {}) => compile(src, Object.keys(vars))(vars);

describe("plot expressions", () => {
  it("follows normal precedence", () => {
    expect(ev("1 + 2 * 3")).toBe(7);
    expect(ev("(1 + 2) * 3")).toBe(9);
    expect(ev("-2^2")).toBe(-4);
    expect(ev("2^3^2")).toBe(512);
    expect(ev("2 * -3")).toBe(-6);
    expect(ev("1.5e2 / .5")).toBe(300);
  });

  it("knows constants, functions and variables", () => {
    expect(ev("cos(pi)")).toBeCloseTo(-1);
    expect(ev("ln(e)")).toBeCloseTo(1);
    expect(ev("log(1000)")).toBeCloseTo(3); // log is log10
    expect(ev("max(1, x, 3)", { x: 7 })).toBe(7);
    expect(ev("u(x) * exp(-x/tau)", { x: 1, tau: 1 })).toBeCloseTo(Math.exp(-1));
    expect(ev("u(x)", { x: -0.1 })).toBe(0);
  });

  it("handles a first-order Bode magnitude", () => {
    expect(ev("-10*log10(1 + (x*tau)^2)", { x: 1000, tau: 0.001 })).toBeCloseTo(-3.0103, 3);
  });

  it("rejects anything that isn't a formula", () => {
    for (const bad of ["alert(1)", "x.constructor", "window", "1 +", "(1", "x y", "sin(1, 2)", "2 ** 3", "`x`", "x[0]", "x; 1"]) {
      expect(() => compile(bad, ["x"]), bad).toThrow(ExpressionError);
    }
  });

  it("only allows declared variables", () => {
    expect(() => compile("x + tau", ["x"])).toThrow(/Unknown name "tau"/);
    expect(() => compile("x + tau", ["x", "tau"])).not.toThrow();
  });
});
