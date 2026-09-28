import { describe, expect, it } from "vitest";
import { cleanText } from "@/lib/upload/cleanText";

describe("cleanText", () => {
  it("removes NUL and control characters but keeps tabs and newlines", () => {
    expect(cleanText("a\u0000b\u0007c\td\ne")).toBe("abc\td\ne");
  });

  it("normalises line endings and blank lines", () => {
    expect(cleanText("one  \r\n\r\n\r\n\r\ntwo\rthree   ")).toBe("one\n\ntwo\nthree");
  });

  it("keeps maths symbols and other unicode", () => {
    expect(cleanText("X(jω) = ∫ x(t) e^{−jωt} dt ∠ 𝑧")).toBe("X(jω) = ∫ x(t) e^{−jωt} dt ∠ 𝑧");
  });
});
