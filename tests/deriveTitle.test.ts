import { describe, expect, it } from "vitest";
import { deriveTitle } from "@/lib/upload/deriveTitle";

describe("deriveTitle", () => {
  it("uses the name most lecture files share", () => {
    expect(
      deriveTitle([
        "ENGR2722-8722 Signals and Systems - Week3.pdf",
        "ENGR2722-8722 Signals and Systems - Week4a.pdf",
        "ENGR2722-8722 Signals and Systems - Week7.pdf",
        "T02_Wk03.pdf",
        "Tutorial_05_Week_07_solutions.pdf",
        "Tute3_solutions.pdf",
      ]),
    ).toBe("ENGR2722-8722 Signals and Systems");
  });

  it("falls back to a single file's cleaned name", () => {
    expect(deriveTitle(["Data_Structures_Week_1.pptx"])).toBe("Data Structures");
  });

  it("falls back when nothing usable is left", () => {
    expect(deriveTitle(["W1.pdf", "Week2.pdf"])).toBe("New course");
    expect(deriveTitle([])).toBe("New course");
  });
});
