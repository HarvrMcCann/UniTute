/*
 * Browser-only: works out a file's type and page/slide count before it's uploaded.
 * Heavy libraries (pdf.js, JSZip) load on demand, only on the upload page.
 */

export type FileKind = "pdf" | "pptx" | "docx";

export const MAX_FILE_BYTES = 50 * 1024 * 1024; // Supabase free-plan limit per file

export const MIME_TYPES: Record<FileKind, string> = {
  pdf: "application/pdf",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export function kindOf(filename: string): FileKind | null {
  const ext = filename.toLowerCase().split(".").pop();
  return ext === "pdf" || ext === "pptx" || ext === "docx" ? ext : null;
}

/** Why a file can't be used, or null if it's fine. */
export function rejectReason(file: File): string | null {
  const ext = file.name.toLowerCase().split(".").pop();
  if (ext === "ppt" || ext === "doc") return `Old .${ext} format: re-save it as .${ext}x in PowerPoint or Word`;
  if (!kindOf(file.name)) return "Only PDF, PowerPoint (.pptx) and Word (.docx) files are supported";
  if (file.size > MAX_FILE_BYTES) return "Larger than 50 MB";
  if (file.size === 0) return "The file is empty";
  return null;
}

/** Pages (PDF, DOCX) or slides (PPTX). Null when it can't be determined; that's not an error. */
export async function countPages(file: File, kind: FileKind): Promise<number | null> {
  try {
    if (kind === "pdf") return await countPdfPages(file);
    const { default: JSZip } = await import("jszip");
    const zip = await JSZip.loadAsync(file);
    if (kind === "pptx") {
      return Object.keys(zip.files).filter((path) => /^ppt\/slides\/slide\d+\.xml$/.test(path)).length || null;
    }
    // DOCX: Word stores its last-known page count in docProps/app.xml
    const app = await zip.file("docProps/app.xml")?.async("string");
    const pages = app?.match(/<Pages>(\d+)<\/Pages>/)?.[1];
    return pages ? Number(pages) : null;
  } catch {
    return null;
  }
}

async function countPdfPages(file: File): Promise<number> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const pages = (await task.promise).numPages;
  await task.destroy();
  return pages;
}
