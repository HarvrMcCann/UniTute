/**
 * Static checks for AI-written interactives, run on the server before one is saved. They catch the
 * mistakes that make a widget fail to start (a tag missing its "<", an element the script looks up
 * that doesn't exist, a syntax error) and a few that make it look wrong (LaTeX shown as raw text,
 * an opaque background). Errors mean it won't work; warnings mean it works but looks off.
 */

export type WidgetProblem = { severity: "error" | "warning"; message: string };

export const MAX_WIDGET_CHARS = 120_000;

const SCRIPT = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
const STYLE = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
const TAGS = "canvas|div|span|svg|input|button|label|select|option|p|h[1-6]|section|output|table|tr|td|th|ul|li|figure|textarea";

const unique = <T,>(xs: T[]) => [...new Set(xs)];

export function lintWidget(html: string): WidgetProblem[] {
  const problems: WidgetProblem[] = [];
  const error = (message: string) => problems.push({ severity: "error", message });
  const warning = (message: string) => problems.push({ severity: "warning", message });

  if (!html.trim()) return [{ severity: "error", message: "The widget is empty." }];
  if (html.length > MAX_WIDGET_CHARS) error(`The code is ${html.length.toLocaleString()} characters; the limit is ${MAX_WIDGET_CHARS.toLocaleString()}.`);

  const scripts = [...html.matchAll(SCRIPT)].map((m) => ({ attrs: m[1], code: m[2] }));
  const styles = [...html.matchAll(STYLE)].map((m) => m[1]).join("\n");
  const markup = html.replace(SCRIPT, "").replace(STYLE, "");
  const code = scripts.map((s) => s.code).join("\n");

  // Tags written without their opening "<" show up as text and the element never exists.
  const brokenTag = new RegExp(`(^|[^<\\w/-])(${TAGS})\\s+(id|class|style|type|width|height|for|min|max|value)\\s*=\\s*["']`, "gi");
  for (const m of markup.matchAll(brokenTag)) {
    const at = (m.index ?? 0) + m[1].length;
    error(`Malformed tag near "${markup.slice(at, at + 40).trim()}": it is missing its opening "<", so the element is never created.`);
  }

  // Elements the script looks up by id must exist (unless the script assigns ids itself).
  const assignsIds = /\.id\s*=|setAttribute\(\s*["']id["']/.test(code);
  if (!assignsIds) {
    const defined = new Set([...html.matchAll(/\bid\s*=\s*["']([^"'\s]+)["']/g)].map((m) => m[1]));
    const dollarIsById = /\$\s*=\s*\(?\s*\w+\s*\)?\s*=>\s*document\.getElementById\(/.test(code);
    const referenced = [
      ...[...code.matchAll(/getElementById\(\s*["']([^"']+)["']\s*\)/g)].map((m) => m[1]),
      ...[...code.matchAll(/querySelector(?:All)?\(\s*["']#([\w-]+)["']\s*\)/g)].map((m) => m[1]),
      ...(dollarIsById ? [...code.matchAll(/\$\(\s*["']([^"']+)["']\s*\)/g)].map((m) => m[1]) : []),
    ];
    const missing = unique(referenced).filter((id) => !defined.has(id));
    if (missing.length) error(`The script uses element id${missing.length > 1 ? "s" : ""} ${missing.map((id) => `"${id}"`).join(", ")} but no element has ${missing.length > 1 ? "those ids" : "that id"}.`);
  }

  // Syntax errors stop the whole script. new Function only parses here; nothing runs.
  scripts.forEach((s, i) => {
    if (/type\s*=\s*["']?module/i.test(s.attrs)) return error("Module scripts aren't supported; use a plain <script>.");
    try {
      new Function(s.code);
    } catch (e) {
      error(`Script ${scripts.length > 1 ? `${i + 1} ` : ""}has a syntax error: ${e instanceof Error ? e.message : String(e)}`);
    }
  });

  // No network: these would be blocked by the frame's CSP and leave the widget broken.
  if (/\b(src|href)\s*=\s*["']\s*(https?:)?\/\//i.test(html) || /url\(\s*["']?\s*(https?:)?\/\//i.test(styles) || /\b(fetch|XMLHttpRequest|importScripts)\s*\(|\bimport\s*\(/.test(code)) {
    error("It loads something from the network (a URL, fetch or import); everything must be inline.");
  }

  // LaTeX shows up as raw text in HTML and canvas.
  const visibleText = markup.replace(/<[^>]*>/g, " ");
  const drawnText = [...code.matchAll(/fillText\(([^;]*)/g)].map((m) => m[1]).join(" ");
  if (/\\(frac|omega|alpha|beta|theta|phi|pi|sum|int|cdot|left|right|mathrm|text)(?![a-zA-Z])|\$[^$\n]+\$/.test(visibleText + " " + drawnText)) {
    warning("It contains LaTeX syntax (e.g. \\omega or $...$), which shows as raw text: use Unicode (ω, π, ·) instead.");
  }
  if (/[\^_]\{/.test(drawnText)) {
    warning('Canvas text contains ^{...} or _{...}, which is drawn literally: use Unicode (ω₀, x²), or put the formula in an HTML element with class="math".');
  }

  // The page background must stay transparent so the widget sits on the lesson's panel.
  if (/(^|[\s,}])(html|body|:root)\s*(,[^{]*)?\{[^}]*background(-color)?\s*:\s*(?!\s*(transparent|none|inherit)\b)/i.test(styles)) {
    warning("It sets a background on html/body; the page background must stay transparent.");
  }

  return problems;
}

export const hasErrors = (problems: WidgetProblem[]) => problems.some((p) => p.severity === "error");

export const describeProblems = (problems: WidgetProblem[]) => problems.map((p) => `- ${p.severity === "error" ? "Error" : "Warning"}: ${p.message}`).join("\n");
