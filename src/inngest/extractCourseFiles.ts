import { OfficeParser } from "officeparser";
import { createAdminClient } from "@/lib/supabase/admin";
import { inngest } from "./client";

/*
 * Extracts text from every pending file in a course, one resumable step per file,
 * then marks the course "extracted". A file that can't be parsed is marked failed
 * (with a reason) instead of failing the whole course.
 */

const BUCKET = "source-files";
/** Keeps a single huge document (e.g. a whole textbook) from dominating storage and prompts. */
const MAX_CHARS = 400_000;

type PendingFile = { id: string; storage_path: string; filename: string };

export const extractCourseFiles = inngest.createFunction(
  {
    id: "extract-course-files",
    triggers: [{ event: "course/files.uploaded" }],
    concurrency: { limit: 1, key: "event.data.courseId" },
    retries: 2,
    onFailure: async ({ event }) => {
      const courseId = (event.data.event.data as { courseId: string }).courseId;
      await createAdminClient().from("courses").update({ status: "failed" }).eq("id", courseId);
    },
  },
  async ({ event, step }) => {
    const { courseId } = event.data as { courseId: string };

    const files = await step.run("find pending files", async () => {
      const { data, error } = await createAdminClient()
        .from("source_files")
        .select("id, storage_path, filename")
        .eq("course_id", courseId)
        .in("status", ["pending", "extracting"]);
      if (error) throw new Error(error.message);
      return data as PendingFile[];
    });

    const results = await Promise.all(
      files.map((file) => step.run(`extract ${file.id}`, () => extractOne(file))),
    );

    await step.run("mark course extracted", async () => {
      const { error } = await createAdminClient()
        .from("courses")
        .update({ status: "extracted", updated_at: new Date().toISOString() })
        .eq("id", courseId);
      if (error) throw new Error(error.message);
    });

    return { files: results.length, failed: results.filter((r) => !r.ok).length };
  },
);

async function extractOne(file: PendingFile): Promise<{ ok: boolean; chars: number }> {
  const admin = createAdminClient();
  await admin.from("source_files").update({ status: "extracting", error: null }).eq("id", file.id);

  // Download errors are thrown so Inngest retries them; parse errors are the file's fault.
  const { data: blob, error: downloadError } = await admin.storage.from(BUCKET).download(file.storage_path);
  if (downloadError || !blob) throw new Error(`download ${file.filename}: ${downloadError?.message}`);

  let text: string;
  let pages: number | null = null;
  try {
    const ast = await OfficeParser.parseOffice(Buffer.from(await blob.arrayBuffer()), { extractAttachments: false });
    const out = await ast.to("text", { includeImages: false, textConfig: { preserveLayout: false } });
    text = tidy(out.value);
    const metaPages = (ast.metadata as { pages?: unknown } | undefined)?.pages;
    if (typeof metaPages === "number" && metaPages > 0) pages = metaPages;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    await admin
      .from("source_files")
      .update({ status: "failed", error: `Couldn't read this file: ${reason}`.slice(0, 500) })
      .eq("id", file.id);
    return { ok: false, chars: 0 };
  }

  const truncated = text.length > MAX_CHARS;
  const { error } = await admin
    .from("source_files")
    .update({
      status: "done",
      extracted_text: truncated ? text.slice(0, MAX_CHARS) : text,
      char_count: text.length,
      error: text.trim() ? (truncated ? `Very long file: kept the first ${MAX_CHARS.toLocaleString()} characters` : null) : "No text found (it may be scanned images)",
      ...(pages !== null && { page_count: pages }),
    })
    .eq("id", file.id);
  if (error) throw new Error(error.message);
  return { ok: true, chars: text.length };
}

/** Collapses runs of blank lines and trailing spaces; PDFs produce a lot of both. */
function tidy(text: string): string {
  return text
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
