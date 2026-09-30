import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { hasErrors, lintWidget } from "@/lib/widget/lint";

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
const errors = (html: string) => lintWidget(html).filter((p) => p.severity === "error").map((p) => p.message);

describe("lintWidget", () => {
  it("passes a working generated widget", () => {
    expect(hasErrors(lintWidget(fixture("widget-ok.html")))).toBe(false);
  });

  it("catches the real broken widget: a tag missing its '<'", () => {
    const found = errors(fixture("widget-broken-tag.html"));
    expect(found.some((m) => m.includes('missing its opening "<"'))).toBe(true);
    expect(found.some((m) => m.includes('"main"'))).toBe(true);
  });

  it("flags ids the script uses that don't exist", () => {
    const html = `<div id="a"></div><script>document.getElementById("a");document.querySelector("#b")</script>`;
    expect(errors(html)).toEqual([expect.stringContaining('"b"')]);
  });

  it("skips the id check when the script assigns ids itself", () => {
    expect(errors(`<script>const d=document.createElement("div");d.id="x";document.getElementById("x")</script>`)).toEqual([]);
  });

  it("flags syntax errors without running the code", () => {
    expect(errors(`<script>const x = ;</script>`)).toEqual([expect.stringContaining("syntax error")]);
    expect(errors(`<script>throw new Error("not run")</script>`)).toEqual([]);
  });

  it("flags network access", () => {
    expect(errors(`<script src="https://cdn.example.com/lib.js"></script>`).length).toBe(1);
    expect(errors(`<script>fetch("/x")</script>`).length).toBe(1);
  });

  it("warns about LaTeX and opaque backgrounds", () => {
    const warnings = lintWidget(`<style>body{background:#111}</style><p>\\omega_0</p><script>ctx.fillText("φ_{N+1}",0,0)</script>`)
      .filter((p) => p.severity === "warning");
    expect(warnings).toHaveLength(3);
    expect(lintWidget(`<style>body{background:transparent}</style><p class="math">X(e^{jω})</p>`)).toEqual([]);
  });
});
