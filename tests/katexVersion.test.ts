import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const version = (path: string) => (require(path) as { version: string }).version;

describe("KaTeX", () => {
  // Our stylesheet comes from the root `katex` package, but inline maths is rendered by
  // rehype-katex's KaTeX. If the versions differ, class names can drift apart (0.18 renamed
  // .sizing to .katex-sizing) and subscripts/superscripts stop shrinking and shifting.
  it("uses one version for the CSS and for rehype-katex", () => {
    const root = version("katex/package.json");
    const rehype = version(require.resolve("katex/package.json", { paths: [require.resolve("rehype-katex")] }));
    expect(rehype).toBe(root);
  });
});
