import { getCourse, locateLesson } from "@/lib/course/load";
import { adjustCredit, creditCost, getCredit, MIN_CREDIT_USD } from "@/lib/credits";
import { getCourseProgress } from "@/lib/progress";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getUser } from "@/lib/supabase/server";
import { blockLabel, courseMap, knowledgeLevel, lessonContext } from "@/lib/tutor/context";
import { HISTORY_MESSAGES, MAX_MESSAGE_CHARS, streamTutorReply, tutorMessages, tutorSystem, type TutorTurn } from "@/lib/tutor/tutor";
import { TUTOR_STREAM_END, type TutorStreamEnd } from "@/lib/tutor/protocol";

// A reply usually streams in 3-15s; this is headroom.
export const maxDuration = 60;

const fail = (status: number, error: string, needsCredit = false) => Response.json({ error, needsCredit }, { status });

/**
 * Ask the tutor. Streams the reply as plain text, then TUTOR_STREAM_END and a small JSON trailer
 * (new credit balance, or an error). Charged to the student's credit at Haiku's cost.
 */
export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return fail(401, "Sign in to chat with the tutor.");

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return fail(400, "Bad request.");
  }
  const courseId = String(body.courseId ?? "");
  const lessonKey = String(body.lessonKey ?? "");
  const question = String(body.message ?? "").trim().slice(0, MAX_MESSAGE_CHARS);
  if (!question) return fail(400, "Write a question first.");

  const supabase = await createClient();
  if ((await getCredit(supabase, user.id)) < MIN_CREDIT_USD) {
    return fail(402, "The tutor runs on credit, and you're out.", true);
  }

  // RLS decides whether this user can read the course.
  const loaded = await getCourse(courseId);
  const location = loaded && locateLesson(loaded.course, lessonKey);
  if (!loaded || !location) return fail(404, "Open a lesson to ask the tutor about it.");
  const { course } = loaded;
  const { lesson } = location;

  const [progress, history] = await Promise.all([
    getCourseProgress(loaded),
    supabase
      .from("tutor_messages")
      .select("role, content")
      .eq("user_id", user.id)
      .eq("course_id", courseId)
      .order("created_at", { ascending: false })
      .limit(HISTORY_MESSAGES),
  ]);

  const questions = new Map(lesson.questions.map((q) => [q.id, q]));
  const anchor = lesson.blocks.find((b) => b.id === body.anchorBlockId) ?? null;
  const studentContext = `${anchor ? `They're looking at [${anchor.id}] ${blockLabel(anchor, questions)}.\n\n` : ""}${knowledgeLevel(course, lesson, progress.mastery)}`;

  const { error: saveError } = await supabase.from("tutor_messages").insert({
    user_id: user.id,
    course_id: courseId,
    lesson_key: lesson.id,
    role: "user",
    content: question,
    anchor_block_id: anchor?.id ?? null,
  });
  if (saveError) return fail(500, "Couldn't send that. Try again.");

  const system = tutorSystem(course.title, courseMap(course), lessonContext(lesson));
  const messages = tutorMessages(((history.data ?? []) as TutorTurn[]).reverse(), question, studentContext);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (text: string) => {
        try {
          controller.enqueue(encoder.encode(text));
        } catch {
          // the student closed the chat; keep going so the reply is saved and charged
        }
      };
      let end: TutorStreamEnd;
      try {
        const reply = await streamTutorReply(system, messages, send);
        const admin = createAdminClient();
        const [credit] = await Promise.all([
          adjustCredit(admin, user.id, -creditCost(reply.apiCostUsd), `tutor ${courseId}`),
          admin.from("tutor_messages").insert({
            user_id: user.id,
            course_id: courseId,
            lesson_key: lesson.id,
            role: "assistant",
            content: reply.text.slice(0, 20000),
          }),
        ]);
        end = { credit: credit ?? undefined };
      } catch (error) {
        console.warn("tutor reply failed:", error instanceof Error ? error.message : error);
        end = { error: "The tutor couldn't answer just now. Try again in a moment." };
      }
      send(TUTOR_STREAM_END + JSON.stringify(end));
      try {
        controller.close();
      } catch {
        // already closed
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store, no-transform", "X-Accel-Buffering": "no" },
  });
}
