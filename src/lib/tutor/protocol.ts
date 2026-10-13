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
