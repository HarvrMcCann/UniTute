/*
 * The tutor endpoint streams plain text, then this separator and a JSON trailer. Shared by the
 * route and the chat panel.
 */
export const TUTOR_STREAM_END = "\u0000";

export type TutorStreamEnd = { credit?: number; error?: string };

/** A message as the chat panel shows it. */
export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  lessonKey: string | null;
  anchorBlockId: string | null;
};

/** A question about highlighted text is stored with the text quoted above it. */
export const withQuote = (message: string, quote: string | null) =>
  quote ? `${quote.split("\n").map((line) => `> ${line}`).join("\n")}\n\n${message}` : message;

/** Splits a stored question back into its quote (if any) and the question. */
export function splitQuote(content: string): { quote: string | null; text: string } {
  const match = content.match(/^((?:> .*(?:\n|$))+)\n?([\s\S]*)$/);
  if (!match) return { quote: null, text: content };
  return { quote: match[1].replace(/^> /gm, "").trim(), text: match[2] };
}
