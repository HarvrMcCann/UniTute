import { describe, expect, it } from "vitest";
import { looseMathToSvg, rehypeLooseMath, splitLooseMath } from "@/lib/looseMath";
import { plainMath } from "@/lib/tutor/context";

describe("splitLooseMath", () => {
  it("handles the patterns seen in generated courses", () => {
    expect(splitLooseMath("X(e^{jω})")).toEqual(["X(e", { tag: "sup", children: ["jω"] }, ")"]);
    expect(splitLooseMath("carrier ω_c (rad/s)")).toEqual(["carrier ω", { tag: "sub", children: ["c"] }, " (rad/s)"]);
    expect(splitLooseMath("x_p(t)")).toEqual(["x", { tag: "sub", children: ["p"] }, "(t)"]);
    expect(splitLooseMath("Σ_{n=-∞}^{∞} x[n]")).toEqual([
      "Σ",
      { tag: "sub", children: ["n=-∞"] },
      { tag: "sup", children: ["∞"] },
      " x[n]",
    ]);
    expect(splitLooseMath("e^{jω_0 n}")).toEqual(["e", { tag: "sup", children: ["jω", { tag: "sub", children: ["0"] }, " n"] }]);
  });

  it("leaves ordinary text alone", () => {
    for (const s of ["snake_case names", "a ^ b", "file_name.txt", "2 ^{", "plain text", "_leading"]) {
      expect(splitLooseMath(s)).toEqual([s]);
    }
  });

  it("makes SVG tspans", () => {
    expect(looseMathToSvg("x_p(t)")).toBe('x<tspan baseline-shift="sub" font-size="72%">p</tspan><tspan font-size="100%"></tspan>(t)');
  });

  it("rewrites markdown text but not KaTeX or code", () => {
    const tree = {
      type: "root",
      children: [
        { type: "text", value: "z = re^{jφ}" },
        { type: "element", tagName: "code", children: [{ type: "text", value: "a_b" }] },
        { type: "element", tagName: "span", properties: { className: ["katex"] }, children: [{ type: "text", value: "x_1" }] },
      ],
    };
    rehypeLooseMath()(tree);
    expect(tree.children[0]).toEqual({ type: "text", value: "z = re" });
    expect(tree.children[1]).toMatchObject({ tagName: "sup" });
    expect(tree.children[2]).toMatchObject({ tagName: "code", children: [{ value: "a_b" }] });
    expect(tree.children[3]).toMatchObject({ children: [{ value: "x_1" }] });
  });
});

describe("plainMath (chip labels)", () => {
  it("makes LaTeX readable", () => {
    expect(plainMath("x_p(t) = x(t)\\,p(t)")).toBe("x_p(t) = x(t) p(t)");
    expect(plainMath("\\omega_s = \\frac{2\\pi}{T}")).toBe("ω_s = 2π/T");
  });
});
