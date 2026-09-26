"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { inngest } from "@/inngest/client";
import { createClient, getUser } from "@/lib/supabase/server";
import { MAX_WEEK } from "@/lib/upload/guessWeek";

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

const courseDetails = z.object({
  title: z.string().trim().min(1, "Give the course a name").max(200),
  courseCode: z.string().trim().max(40),
  university: z.string().trim().max(120),
  year: z.number().int().min(2000).max(2100).nullable(),
  notes: z.string().trim().max(10_000),
});

export type CourseDetails = z.infer<typeof courseDetails>;

/** Step 1: create the (draft) course the files will belong to. */
export async function createDraftCourse(input: CourseDetails): Promise<Result<{ courseId: string; userId: string }>> {
  const user = await getUser();
  if (!user) return { ok: false, error: "Please sign in again." };
  const parsed = courseDetails.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const d = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("courses")
    .insert({
      owner_id: user.id,
      title: d.title,
      course_code: d.courseCode || null,
      university: d.university || null,
      year: d.year,
      notes: d.notes,
      status: "draft",
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, courseId: data.id, userId: user.id };
}

const uploadedFile = z.object({
  id: z.uuid(),
  box: z.enum(["content", "objectives"]),
  week: z.number().int().min(1).max(MAX_WEEK).nullable(),
  filename: z.string().min(1).max(300),
  kind: z.enum(["pdf", "pptx", "docx"]),
  pageCount: z.number().int().positive().nullable(),
  sizeBytes: z.number().int().positive(),
  storagePath: z.string().min(1),
});

export type UploadedFile = z.infer<typeof uploadedFile>;

/** Step 2 (after the browser has put the files in storage): record them and start extraction. */
export async function registerFiles(courseId: string, files: UploadedFile[]): Promise<Result<object>> {
  const user = await getUser();
  if (!user) return { ok: false, error: "Please sign in again." };
  const parsed = z.array(uploadedFile).min(1).max(100).safeParse(files);
  if (!parsed.success) return { ok: false, error: "Some file details were invalid." };

  const supabase = await createClient();
  // RLS only lets owners add files; checking storage paths keeps rows pointing at their own folder.
  const prefix = `${user.id}/${courseId}/`;
  if (parsed.data.some((f) => !f.storagePath.startsWith(prefix))) return { ok: false, error: "Invalid file location." };

  const { error } = await supabase.from("source_files").insert(
    parsed.data.map((f) => ({
      id: f.id,
      course_id: courseId,
      box: f.box,
      week: f.week,
      filename: f.filename,
      kind: f.kind,
      page_count: f.pageCount,
      size_bytes: f.sizeBytes,
      storage_path: f.storagePath,
      status: "pending",
    })),
  );
  if (error) return { ok: false, error: error.message };

  const { error: statusError } = await supabase
    .from("courses")
    .update({ status: "extracting", updated_at: new Date().toISOString() })
    .eq("id", courseId);
  if (statusError) return { ok: false, error: statusError.message };

  await inngest.send({ name: "course/files.uploaded", data: { courseId } });
  revalidatePath("/");
  return { ok: true };
}

/** Week corrections on the review page. */
export async function setFileWeek(fileId: string, week: number | null): Promise<Result<object>> {
  const user = await getUser();
  if (!user) return { ok: false, error: "Please sign in again." };
  const parsed = z.number().int().min(1).max(MAX_WEEK).nullable().safeParse(week);
  if (!parsed.success) return { ok: false, error: "Invalid week" };

  const supabase = await createClient();
  const { error } = await supabase.from("source_files").update({ week: parsed.data }).eq("id", fileId);
  return error ? { ok: false, error: error.message } : { ok: true };
}

const PREVIEW_CHARS = 4000;

/** The start of a file's extracted text, loaded when the user asks to see it. */
export async function getTextPreview(fileId: string): Promise<Result<{ text: string; total: number }>> {
  const user = await getUser();
  if (!user) return { ok: false, error: "Please sign in again." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("source_files")
    .select("extracted_text, char_count")
    .eq("id", fileId)
    .maybeSingle();
  if (error || !data) return { ok: false, error: error?.message ?? "File not found" };
  const text = (data.extracted_text as string | null) ?? "";
  return { ok: true, text: text.slice(0, PREVIEW_CHARS), total: data.char_count ?? text.length };
}
