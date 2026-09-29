import sample from "@/content/sample-course.json";
import { courseSchema } from "@/lib/course/schema";
import type { CoursePlan, LengthMode, PlannedLesson } from "./assemble";
import { lessonToDraft } from "./examples";
import { toWire } from "./wire";

/*
 * Prompts for the two generation passes. Everything in the system prompts is identical
 * for every course and lesson, so it's cached; per-course and per-lesson material comes
 * after it (see generateLesson in claude.ts for the cache layout).
 */

const LENGTH_GUIDE: Record<LengthMode, string> = {
  cram:
    "CRAM: the student has little time (e.g. exam soon). About 1 lesson per teaching week (2 for a very dense week), 8-12 minutes each. Only what is most examinable, stated crisply. 2-3 checks per lesson.",
  recommended:
    "RECOMMENDED: thorough but efficient. About 2-3 lessons per teaching week, 12-18 minutes each. Cover everything taught, with intuition, a worked example where it helps, and 3-5 checks per lesson.",
  deep:
    "DEEP: the student wants real mastery. About 3-5 lessons per teaching week, 15-25 minutes each. Build intuition carefully, include derivations and multiple worked examples, connect ideas across weeks, and 5-8 checks per lesson.",
};

// ---------- Outline ----------

export const OUTLINE_SYSTEM = `You design university courses for UniTute, an app that turns a unit's lecture slides and readings into an interactive course: short lessons, knowledge checks, and an AI tutor.

You will receive a student's source files, grouped by teaching week, as extracted text. Some may also be learning objectives, unit outlines or past exams. Plan the course: units, lessons within units, and the concepts the course teaches.

How to plan:
- Usually one unit per teaching week that has content. Merge very thin weeks with a neighbour; split a week only if it clearly covers two separate topics. Files with no week are either whole-unit references (textbooks) or unassigned material: fold their relevant parts into the weeks where they fit.
- Order units and lessons in the order the material is taught. Each lesson should be one coherent idea a student could finish in one sitting.
- Objectives files (learning objectives, unit outlines, past exams, tutorial or practice questions) define what the student actually needs. When they're provided, the course is built around them: every lesson serves one or more of the skills or topics they ask for, depth follows how heavily they're examined or practised, and lecture material they never touch gets at most a brief mention inside a related lesson (never its own lesson). Each lesson's plan names the objective(s) it serves and says what the student must be able to do by the end, so the checks can test exactly that. Never copy exam or tutorial questions; write new ones that test the same skills.
- Stay within the lesson budget you're given. Prefer fewer, well-focused lessons: merge closely related topics rather than splitting them.
- Tutorial questions and solutions are practice material: point lessons at them for worked examples and checks.
- Ignore administration (assessment dates, staff contact details, policies, textbook-purchasing notes).
- Concepts are the distinct ideas mastery is tracked on (typically 3-8 per week). A concept can appear in several lessons. Keys are short, lowercase and hyphenated.
- For each lesson, list the IDs of the source files it draws on, and write a plan for the lesson writer: the points to teach in order, which examples to work through, typical misconceptions to address, and what the checks should test.
- In each plan, record how the sources write the lesson's key quantities and methods (e.g. "damping ratio is ξ; phase written ∠H(jω); angle found as arctan(b/a) with a quadrant correction"), so lessons match what the student sees in class.
- If the source material contains an error (a wrong formula, a sign slip), plan to teach the correct version and note the correction in the plan.
- Titles are plain and specific ("Bode plots and decibels", not "Unlocking the Power of Bode Plots").`;

export type OutlineSource = {
  id: string;
  filename: string;
  box: "content" | "objectives";
  week: number | null;
  text: string;
};

const OUTLINE_FILE_CHAR_LIMIT = 80_000;

const LESSONS_PER_WEEK: Record<LengthMode, [number, number]> = {
  cram: [1, 1.5],
  recommended: [2, 3],
  deep: [3, 5],
};

/** How many lessons the whole course should have: set by the number of teaching weeks and the length choice. */
export function lessonBudget(sources: Pick<OutlineSource, "box" | "week">[], mode: LengthMode): { weeks: number; min: number; max: number } {
  const weeks = Math.max(1, new Set(sources.filter((s) => s.box === "content" && s.week !== null).map((s) => s.week)).size);
  const [lo, hi] = LESSONS_PER_WEEK[mode];
  const min = Math.max(1, Math.round(weeks * lo));
  return { weeks, min, max: Math.max(min, Math.ceil(weeks * hi)) };
}

export function outlinePrompt(input: {
  courseTitle: string;
  notes: string;
  lengthMode: LengthMode;
  sources: OutlineSource[];
}): string {
  const describe = (s: OutlineSource) => {
    const shown = s.text.slice(0, OUTLINE_FILE_CHAR_LIMIT);
    const cut =
      s.text.length > shown.length
        ? `\n[Only the first ${OUTLINE_FILE_CHAR_LIMIT.toLocaleString()} of ${s.text.length.toLocaleString()} characters are shown. The lesson writer sees the whole file.]`
        : "";
    return `<file id="${s.id}" name="${escapeAttr(s.filename)}" week="${s.week ?? "none"}">\n${shown || "(no text could be extracted)"}${cut}\n</file>`;
  };
  const byWeek = [...input.sources.filter((s) => s.box === "content")].sort((a, b) => (a.week ?? 999) - (b.week ?? 999));
  const objectives = input.sources.filter((s) => s.box === "objectives");

  const budget = lessonBudget(input.sources, input.lengthMode);

  return `Course name given by the student: ${input.courseTitle}

Length the student chose:
${LENGTH_GUIDE[input.lengthMode]}

Lesson budget: the files cover ${budget.weeks} teaching week${budget.weeks === 1 ? "" : "s"}, so plan ${budget.min === budget.max ? `exactly ${budget.min}` : `between ${budget.min} and ${budget.max}`} lessons in total. This is a firm limit: combine related topics into one lesson rather than exceeding it.
${objectives.length ? "Objectives files are provided: they define the scope. Build lessons around what they ask the student to know and do; lecture material they don't touch gets at most a brief mention inside a related lesson.\n" : ""}
${input.notes.trim() ? `The student's notes (their preferences; follow them where sensible):\n<notes>\n${input.notes.trim()}\n</notes>\n\n` : ""}<content_files>
${byWeek.map(describe).join("\n\n")}
</content_files>
${objectives.length ? `\n<objectives_files>\n${objectives.map(describe).join("\n\n")}\n</objectives_files>\n` : ""}
Plan the course.`;
}

// ---------- Lessons ----------

const exampleLesson = (() => {
  const course = courseSchema.parse(sample);
  const lesson = course.units[0].lessons[2]; // "Frequency response of LTI systems": every block type we care about
  return JSON.stringify(toWire(lessonToDraft(lesson).content), null, 1);
})();

export const LESSON_SYSTEM = `You write lessons for UniTute, an app that turns a unit's lecture slides and readings into an interactive course. A student reads your lesson on a phone or laptop, answers knowledge checks along the way, and can ask an AI tutor about any part of it.

You will receive the course outline, the source files for this part of the course, and the plan for one lesson. Write that lesson as a list of blocks plus the questions its check blocks use.

Teaching:
- Explain in your own words, clearly and warmly, like an excellent tutor. Build intuition before formalism, then state the precise version. Short paragraphs; no filler, no hype.
- Follow the lesson plan and stay within this lesson's scope (the outline shows what other lessons cover). The student hasn't necessarily seen the slides: the lesson must stand on its own.
- Be correct. Where the source has an error, teach the correct version and briefly say what differs from the slides.
- Don't reproduce long passages from the sources, and never copy exam questions.
- Notation: use the course's own notation exactly, so nothing looks unfamiliar when the student is in class. Match the sources' symbols and variable names (j or i, ξ or ζ, X(jω) or X(ω)), function names and how they're written, sign and angle conventions, units, and method names. Don't introduce notation, abbreviations or techniques the sources don't use (such as atan2, programming-style names, or a different textbook's symbols). If something must be added, write it in the course's style, define it where it first appears, and at most mention a common alternative once, in words, after the course's version. Where the sources use no particular notation, use the most standard textbook form.
- Use the same terminology and English spelling conventions as the sources.

Blocks:
- text: markdown paragraphs and lists. Inline maths as $...$.
- heading: splits a lesson into 2-4 sections.
- definition: a key term, defined precisely.
- callout: keyIdea (the one thing to remember; at most 2 per lesson), tip, warning (common mistake), example (a concrete illustration). Optional short title.
- workedExample: a problem, 2-5 steps revealed one at a time, and the answer. Each step should be something the student can try before revealing.
- math: one display equation (raw LaTeX, no $ delimiters). For several related equations use \\begin{gathered} ... \\\\ ... \\end{gathered} so they stack on a phone; keep each line short.
- code: only for programming content.
- summary: the last block, 3-5 points.
- check: places a question, right after the section it tests.

Visuals and interactives. You have real creative freedom here: choose whatever teaches this lesson best. Most lessons should include at least one of these, placed right where it helps, and none should be decoration.
- plot: graphs of formulas the app draws. Use it to show a shape or a relationship, and add sliders (params) so the student can see how a parameter changes it (a time constant in a step response, a damping ratio, a cutoff frequency). Formulas are in x and the param names, using + - * / ^ ( ), numbers, pi, e and these functions: sin cos tan asin acos atan sinh cosh tanh exp ln log10 log (= log10) sqrt abs sign min max pow mod floor ceil round u (unit step) rect sinc deg rad. Real numbers only: write magnitudes and phases out explicitly (e.g. "-10*log10(1 + (x*tau)^2)" or "-deg(atan(x*tau))"). Log x axes suit Bode plots and anything over decades; use style "stem" for discrete-time sequences (evaluated at integer x). Up to 5 series and 4 sliders; label the axes with units.
- diagram: a clean SVG drawing: circuits, block diagrams, labelled sketches, geometry, timelines. A single <svg> with a viewBox (about 700 wide), no scripts, links or external images. Colour everything with these variables inside style attributes or an inner <style> (the app sets them for light and dark themes): var(--ink) for lines and text, var(--muted), var(--accent), var(--accent-2), var(--accent-3), var(--warn), var(--panel) for soft fills. Transparent background; text 14-18 units; keep labels in the course's notation.
- interactive: your own custom interactive that a developer builds from your brief: a simulation, a builder, a manipulable model, an explorable (for electronics, a small circuit builder; for probability, a sampling simulator; for a process, a step-through animation). Use one when doing something with the idea teaches what reading can't. Be ambitious and specific: the brief is the complete spec (what's shown, every control, how it responds, the insight the student should reach, sensible defaults and ranges, the notation to use). Students value these highly: in RECOMMENDED and DEEP courses, include one in most lessons, wherever there is something to explore (a parameter to vary, a system to build, a process to step through), and don't default to a plot when a richer interactive would teach more. At most two per lesson (at most one in CRAM). Also give a fallback explanation shown if it can't be built.

Study tools (gathered into each unit's flashcard deck and formula sheet):
- flashcards: 3-8 per lesson covering the key terms, relationships and "what happens if" facts. Front: a short prompt or term; back: a concise answer. Course notation.
- formulas: the formulas from this lesson worth having on a formula sheet (0-6), each with a name, the LaTeX (as in a math block), and a short note on what it means or when to use it.

Knowledge checks:
- Test understanding and application, not recall of wording. Each question's conceptKey must be one of the lesson's concepts.
- multipleChoice: 4 options (occasionally 3), exactly one correct, distractors drawn from real misconceptions. The app shuffles options, so never write options that refer to others ("all of the above", "A and B").
- shortAnswer: a question with a short, checkable answer. modelAnswer is what a strong student writes; markingGuide tells a marker exactly what earns credit and which common wrong answers to reject.
- ordering: only for genuinely sequential things (steps of a method, stages of a process) with one correct order. Give items in the correct order.
- explanation: why the answer is right and why the tempting wrong answer is wrong, in 1-3 sentences.

Formatting inside strings:
- Markdown and LaTeX go inside JSON strings, so every LaTeX backslash is written once in the maths itself (\\frac, \\omega); the JSON encoding handles escaping.
- In markdown tables write |x| as \\lvert x \\rvert so the table isn't broken.
- Write negative angles as \\angle{-20^\\circ} so the minus isn't spaced as subtraction.

Output format: every block is one object with a "type" and these fields (all others null):
text: text · heading: text · callout: variant, title (optional), text · definition: term, text · workedExample: problem, steps, answer · code: code, language, caption · math: code (the LaTeX), caption · summary: steps (the points) · check: questionRef · plot: title, caption, plot · diagram: code (the <svg>), language (alt text), caption · interactive: title, brief, text (the fallback explanation).
Questions: multipleChoice uses options and answerIndex; ordering uses options (in the correct order); shortAnswer uses modelAnswer and markingGuide.

Here is an example of a finished lesson in exactly the format to produce (from a different course; match its quality, tone and structure, not its content):
<example_lesson>
${exampleLesson}
</example_lesson>`;

export function courseOutlineText(plan: CoursePlan): string {
  const lines = [`Course: ${plan.title}`, plan.summary, "", "Concepts (key: name):"];
  for (const c of plan.concepts) lines.push(`- ${c.id.slice(2)}: ${c.name}`);
  lines.push("", "Units and lessons:");
  for (const u of plan.units) {
    lines.push(`- ${u.title}${u.week ? ` (week ${u.week})` : ""}`);
    for (const l of u.lessons) lines.push(`  - ${l.title}: ${l.summary}`);
  }
  return lines.join("\n");
}

export function lessonRequest(plan: CoursePlan, lesson: PlannedLesson): string {
  const unit = plan.units.find((u) => u.lessons.some((l) => l.id === lesson.id))!;
  const concepts = plan.concepts.filter((c) => lesson.conceptIds.includes(c.id));
  return `Write this lesson.

Unit: ${unit.title}
Lesson: ${lesson.title}
Summary: ${lesson.summary}
Target length: about ${lesson.estMinutes} minutes of reading and checks.
Length setting: ${LENGTH_GUIDE[plan.lengthMode]}

Concepts this lesson teaches (use these keys for questions):
${concepts.map((c) => `- ${c.id.slice(2)}: ${c.name}. ${c.description}`).join("\n") || "- (none listed; use the closest concept key from the outline)"}

Lesson plan:
${lesson.plan || "(no plan given: teach the lesson's summary using the sources)"}`;
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

// ---------- Interactives ----------

export const WIDGET_SYSTEM = `You build small, polished interactive learning tools for UniTute lessons: simulations, builders, manipulable models and explorables. A lesson writer gives you a brief; you return the widget's code.

The environment (strict; anything else will not work):
- Your code is the <body> content of a page inside a sandboxed iframe: <style>, HTML and inline <script> only. Vanilla JavaScript (modern syntax is fine). Canvas and inline SVG are available.
- No network at all: no external scripts, libraries, fonts, images or fetch. Everything must be self-contained. No forms, alerts, pop-ups, storage or navigation.
- The frame is the lesson's width: about 700px on a laptop and as narrow as 320px on a phone. Lay out responsively (flex-wrap, percentages, canvas sized to its container and redrawn on resize). The frame's height follows your content automatically.
- Colours: use only these CSS variables, which follow the app's light or dark theme: --ink (text, lines), --muted, --faint, --accent, --accent-2, --accent-3, --warn, --good, --bad, --panel (soft fills), --line (borders), --control (input backgrounds). Background stays transparent. For canvas, read colours with getComputedStyle(document.documentElement).getPropertyValue("--ink") and redraw on window "unitute-theme" events.
- Buttons, inputs, selects and range sliders are already styled; add class "primary" to a main action button. Default font is inherited: don't set font-family.
- Maths as plain Unicode text (ω, τ, ξ, ∠, ², ½, ≈, →), not LaTeX.

Quality bar:
- It must teach the brief's insight: the thing the student should notice is visible, labelled and responsive to their actions.
- Use the course's notation exactly as given in the brief.
- Start in a meaningful state (not blank) and label every control with its quantity and units. Show live readouts of key values.
- Touch-friendly (no hover-only interactions; targets at least 32px), keyboard-usable where practical.
- Smooth but light: requestAnimationFrame for animation, no busy loops, cap work per frame. Physically and mathematically correct.
- Clean, calm visual design consistent with a modern learning app: generous spacing, rounded corners, clear hierarchy.
- Robust: guard against invalid input and extreme values; never throw.

Return the body HTML, and the height in CSS pixels the widget needs at 700px wide.`;

export function widgetRequest(input: { courseTitle: string; lessonTitle: string; lessonPlan: string; title: string; brief: string }): string {
  return `Course: ${input.courseTitle}
Lesson: ${input.lessonTitle}

What the lesson covers, including the course's notation:
${input.lessonPlan || "(not given)"}

Interactive to build: ${input.title}
<brief>
${input.brief}
</brief>`;
}
