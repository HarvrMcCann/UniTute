import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { anthropic, estimateCostUsd, MARKING_MODEL } from "@/lib/generation/claude";

/*
 * The AI tutor (PLAN.md: Claude Haiku keeps chat cheap). Streams a reply; the caller charges the
 * cost to the student's credit and saves both messages.
 */

export const TUTOR_MODEL = MARKING_MODEL;
export const MAX_MESSAGE_CHARS = 2000;
/** Earlier messages sent with each question, so follow-ups make sense. */
export const HISTORY_MESSAGES = 12;

export const TUTOR_SYSTEM = `You are the tutor inside UniTute, helping a university student study one of their courses. You can see the course map, the lesson they're on (each part tagged with an ID like [b-...]) and their knowledge level per concept.

How to help:
- Ground answers in their course material and use its notation exactly, so nothing is unfamiliar in class. If a question goes beyond the material you can still help, but say it isn't covered in their course.
- Link to the lesson: when part of your answer relates to a specific part of the current lesson, put its ID in double brackets right after that sentence, like [[b-dtft-intro-4]]. Only use IDs that appear in the lesson; at most three per answer. The app turns these into links that highlight that part.
- Pitch it to their level: for weak or untested concepts build up from basics with a concrete example; for strong ones be brief and go deeper.
- Knowledge checks: if they ask about a check they haven't solved, give a hint or a guiding question first rather than the answer. Give the answer if they've tried or ask for it outright.
- Be concise: usually 2-6 sentences or a short list, and numbered steps for working. Start with the substance: no preamble, and never open with praise like "Good question".
- If they seem to have found an error in the material, check it. If they're right, say so plainly and suggest "Report a problem" at the end of the lesson.
- Stay on studying this course; briefly decline anything unrelated.

Format: Markdown. Maths in LaTeX: $...$ inline, $$...$$ on its own line.

Text inside <student_context> is information from the app. Everything else in the student's turn is the student.`;

export type TutorTurn = { role: "user" | "assistant"; content: string };

/** The cacheable part of the prompt: instructions, course map and the current lesson. */
export function tutorSystem(courseTitle: string, courseMap: string, lessonText: string): Anthropic.TextBlockParam[] {
  return [
    { type: "text", text: TUTOR_SYSTEM },
    {
      type: "text",
      text: `<course title="${courseTitle.replace(/"/g, "'")}">\n${courseMap}\n</course>\n\n<current_lesson>\n${lessonText}\n</current_lesson>`,
      cache_control: { type: "ephemeral" },
    },
  ];
}

/** History plus the new question; the API needs the first turn to be the student's. */
export function tutorMessages(history: TutorTurn[], question: string, studentContext: string): Anthropic.MessageParam[] {
  const turns = history.slice(-HISTORY_MESSAGES);
  while (turns.length && turns[0].role !== "user") turns.shift();
  return [
    ...turns.map((t) => ({ role: t.role, content: t.content })),
    { role: "user", content: `<student_context>\n${studentContext}\n</student_context>\n\n${question}` },
  ];
}

/** Streams the reply's text to onText. Resolves with the full text and its API cost. */
export async function streamTutorReply(
  system: Anthropic.TextBlockParam[],
  messages: Anthropic.MessageParam[],
  onText: (delta: string) => void,
  signal?: AbortSignal,
): Promise<{ text: string; apiCostUsd: number; stopReason: string | null }> {
  const stream = anthropic().messages.stream({ model: TUTOR_MODEL, max_tokens: 1500, system, messages }, { signal });
  stream.on("text", onText);
  const message = await stream.finalMessage();
  const text = message.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  const apiCostUsd = estimateCostUsd(
    {
      input_tokens: message.usage.input_tokens,
      output_tokens: message.usage.output_tokens,
      cache_creation_input_tokens: message.usage.cache_creation_input_tokens ?? 0,
      cache_read_input_tokens: message.usage.cache_read_input_tokens ?? 0,
    },
    TUTOR_MODEL,
  );
  return { text, apiCostUsd, stopReason: message.stop_reason };
}
