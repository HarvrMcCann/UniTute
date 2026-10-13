/*
 * Maths written as plain text outside $...$ (it happens in generated content: "X(e^{jω})", "ω_c",
 * "x_p(t)"). Without this the ^{ } and _ show literally. We turn them into real superscripts and
 * subscripts wherever text is shown: markdown (a rehype plugin), SVG labels (tspans) and widgets.
 * Pure, so it's tested.
 */

export type MathPiece = string | { tag: "sup" | "sub"; children: MathPiece[] };

// ^ or _ right after a letter, digit, closing bracket or big operator, then either {group} or a
// single character that isn't the start of a longer word (so snake_case words are left alone).
const TOKEN = /(?<=[\p{L}\p{N})\]}|Σ∑∫∏])([\^_])(?:\{([^{}]*)\}|([\p{L}\p{N}∞])(?![\p{L}\p{N}]))/gu;

/** The pattern's source, for the widget runtime (which runs inside the iframe, not this bundle). */
export const LOOSE_MATH_SOURCE = TOKEN.source;

// Non-global copy for testing: test() on a global regex moves lastIndex, which matchAll then inherits.
const HAS_TOKEN = new RegExp(TOKEN.source, "u");

export const hasLooseMath = (text: string) => HAS_TOKEN.test(text);

export function splitLooseMath(text: string): MathPiece[] {
  const pieces: MathPiece[] = [];
  let last = 0;
  for (const m of text.matchAll(TOKEN)) {
    const at = m.index ?? 0;
    if (at > last) pieces.push(text.slice(last, at));
    const inner = m[2] ?? m[3];
    pieces.push({ tag: m[1] === "^" ? "sup" : "sub", children: splitLooseMath(inner) });
    last = at + m[0].length;
  }
  if (last < text.length) pieces.push(text.slice(last));
  return pieces;
}

const escapeXml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** SVG text content with tspans for super/subscripts (for diagram and graph labels). */
export function looseMathToSvg(text: string, decoded = false): string {
  const render = (pieces: MathPiece[]): string =>
    pieces
      .map((p) =>
        typeof p === "string"
          ? decoded
            ? escapeXml(p)
            : p
          : // Shift back after the script so following text sits on the baseline again.
            `<tspan baseline-shift="${p.tag === "sup" ? "super" : "sub"}" font-size="72%">${render(p.children)}</tspan><tspan font-size="100%"></tspan>`,
      )
      .join("");
  return render(splitLooseMath(text));
}

// ---------- rehype plugin (markdown) ----------

type HastNode = {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
};

const toHast = (pieces: MathPiece[]): HastNode[] =>
  pieces.map((p) =>
    typeof p === "string"
      ? { type: "text", value: p }
      : { type: "element", tagName: p.tag, properties: {}, children: toHast(p.children) },
  );

const skip = (node: HastNode) => {
  if (node.tagName === "code" || node.tagName === "pre" || node.tagName === "script" || node.tagName === "style") return true;
  const cls = node.properties?.className;
  return Array.isArray(cls) && cls.some((c) => String(c).startsWith("katex"));
};

function walk(node: HastNode) {
  if (!node.children || skip(node)) return;
  node.children = node.children.flatMap((child) => {
    if (child.type === "text" && child.value && hasLooseMath(child.value)) return toHast(splitLooseMath(child.value));
    walk(child);
    return [child];
  });
}

/** Rehype plugin: run after rehype-katex so rendered maths is left alone. */
export function rehypeLooseMath() {
  return (tree: HastNode) => walk(tree);
}

/** A whole SVG with loose maths in its <text> labels turned into tspans (text is already XML-escaped). */
export function svgLooseMath(svg: string): string {
  return svg.replace(/(<text\b[^>]*>)([\s\S]*?)(<\/text>)/g, (_, open: string, body: string, close: string) =>
    open + body.replace(/(^|>)([^<]+)/g, (__, lead: string, text: string) => lead + (hasLooseMath(text) ? looseMathToSvg(text) : text)) + close,
  );
}
