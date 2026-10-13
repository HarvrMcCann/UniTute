import type { Block, Course, Lesson, Question } from "@/lib/course/schema";
import { masterySummaryLine, type MasteryState } from "@/lib/mastery";

/*
 * What the tutor knows: the course map, the current lesson as text with its block IDs (so answers
 * can link back to the right spot), and the student's knowledge level. Pure, so it's tested.
 */

const CALLOUT_NAME = { keyIdea: "Key idea", tip: "Tip", warning: "Common mistake", example: "Example" } as const;

const shorten = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const plain = (md: string) => md.replace(/\s+/g, " ").trim();

/** A short human name for a block, used on the tutor's link chips and in bug reports. */
export function blockLabel(block: Block, questions?: Map<string, Question>): string {
  switch (block.type) {
    case "heading":
      return shorten(plain(block.text), 60);
    case "text":
      return shorten(plain(block.markdown), 48);
    case "callout":
      return block.title ? `${CALLOUT_NAME[block.variant]}: ${shorten(plain(block.title), 44)}` : CALLOUT_NAME[block.variant];
    case "definition":
      return `Definition: ${shorten(plain(block.term), 44)}`;
    case "workedExample":
      return `Worked example: ${shorten(plain(block.problem), 40)}`;
    case "code":
      return block.caption ? `Code: ${shorten(plain(block.caption), 44)}` : "Code";
    case "math":
      return block.caption ? `Equation: ${shorten(plain(block.caption), 44)}` : "Equation";
    case "summary":
      return "Summary";
    case "check": {
      const q = questions?.get(block.questionId);
      return q ? `Check: ${shorten(plain(q.prompt), 44)}` : "Knowledge check";
    }
    case "plot":
      return block.title ? `Graph: ${shorten(plain(block.title), 44)}` : "Graph";
    case "diagram":
      return `Diagram: ${shorten(plain(block.caption ?? block.alt), 44)}`;
    case "widget":
      return `Interactive: ${shorten(plain(block.title), 44)}`;
  }
}

function questionText(q: Question): string {
  switch (q.type) {
    case "multipleChoice":
      return `${q.prompt}\nOptions: ${q.options.map((o, i) => `(${i + 1}) ${o}${i === q.answerIndex ? " [correct]" : ""}`).join(" ")}\nExplanation: ${q.explanation}`;
    case "shortAnswer":
      return `${q.prompt}\nModel answer: ${q.modelAnswer}\nExplanation: ${q.explanation}`;
    case "ordering":
      return `${q.prompt}\nCorrect order: ${q.items.map((item, i) => `${i + 1}. ${item}`).join(" ")}\nExplanation: ${q.explanation}`;
  }
}

function blockText(block: Block, questions: Map<string, Question>): string {
  switch (block.type) {
    case "text":
      return block.markdown;
    case "heading":
      return `## ${block.text}`;
    case "callout":
      return `${CALLOUT_NAME[block.variant]}${block.title ? `: ${block.title}` : ""}\n${block.markdown}`;
    case "definition":
      return `Definition of ${block.term}: ${block.markdown}`;
    case "workedExample":
      return `Worked example. Problem: ${block.problem}\n${block.steps.map((s, i) => `Step ${i + 1}: ${s}`).join("\n")}\nAnswer: ${block.answer}`;
    case "code":
      return `Code (${block.language})${block.caption ? `: ${block.caption}` : ""}\n${block.code}`;
    case "math":
      return `$$${block.latex}$$${block.caption ? `\n${block.caption}` : ""}`;
    case "summary":
      return `Summary:\n${block.points.map((p) => `- ${p}`).join("\n")}`;
    case "check": {
      const q = questions.get(block.questionId);
      return q ? `Knowledge check (${q.type}): ${questionText(q)}` : "Knowledge check";
    }
    case "plot":
      return `Interactive graph${block.title ? `: ${block.title}` : ""}. ${block.y.label} against ${block.x.label}: ${block.series
        .map((s) => `${s.label} = ${s.expr}`)
        .join("; ")}${block.params.length ? `. Sliders: ${block.params.map((p) => `${p.label} (${p.min} to ${p.max})`).join(", ")}` : ""}${block.caption ? `\n${block.caption}` : ""}`;
    case "diagram":
      return `Diagram: ${block.alt}${block.caption ? `\n${block.caption}` : ""}`;
    case "widget":
      return `Interactive: ${block.title}\n${block.description}`;
  }
}

/** The lesson as the tutor sees it, each block tagged with its ID. */
export function lessonContext(lesson: Lesson): string {
  const questions = new Map(lesson.questions.map((q) => [q.id, q]));
  const objectives = lesson.objectives.length ? `\nObjectives it serves:\n${lesson.objectives.map((o) => `- ${o}`).join("\n")}\n` : "";
  return `Lesson: ${lesson.title}
${lesson.summary}${objectives}

${lesson.blocks.map((b) => `[${b.id}]\n${blockText(b, questions)}`).join("\n\n")}`;
}

/** Unit and lesson titles, so the tutor can point to where else something is covered. */
export function courseMap(course: Course): string {
  return course.units
    .map((u) => `${u.week !== null ? `Week ${u.week}: ` : ""}${u.title}\n${u.lessons.map((l) => `  - ${l.title}`).join("\n")}`)
    .join("\n");
}

/** One line per concept in this lesson, then the rest of the course's tested concepts. */
export function knowledgeLevel(course: Course, lesson: Lesson, mastery: Record<string, MasteryState>): string {
  const names = new Map(course.concepts.map((c) => [c.id, c.name]));
  const here = lesson.conceptIds.map((key) => masterySummaryLine(names.get(key) ?? key, mastery[key] ?? null));
  const elsewhere = course.concepts
    .filter((c) => !lesson.conceptIds.includes(c.id) && mastery[c.id])
    .map((c) => masterySummaryLine(c.name, mastery[c.id]));
  return `This lesson's concepts (0 = new to it, 1 = mastered):\n${here.join("\n") || "(none)"}${
    elsewhere.length ? `\n\nOther concepts they've been tested on:\n${elsewhere.join("\n")}` : ""
  }`;
}
