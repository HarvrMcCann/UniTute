"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { getTextPreview, setFileWeek } from "@/app/upload/actions";
import { FileIcon } from "@/components/ui/icons";
import { formatSize } from "./FileRow";
import { WeekSelect } from "./WeekSelect";

export type SourceFile = {
  id: string;
  filename: string;
  kind: "pdf" | "pptx" | "docx";
  week: number | null;
  pageCount: number | null;
  sizeBytes: number | null;
  status: "pending" | "extracting" | "done" | "failed";
  error: string | null;
  charCount: number | null;
};

/** One uploaded file on the review page: week (editable), extraction status and a text preview. */
export function SourceFileRow({ file }: { file: SourceFile }) {
  const router = useRouter();
  const [week, setWeek] = useState(file.week);
  const [saving, startSaving] = useTransition();
  const [preview, setPreview] = useState<{ text: string; total: number } | null>(null);
  const [loadingPreview, startLoadingPreview] = useTransition();
  const [open, setOpen] = useState(false);

  const unit = file.kind === "pptx" ? "slides" : "pages";
  const details = [
    file.pageCount !== null && `${file.pageCount} ${unit}`,
    file.sizeBytes !== null && formatSize(file.sizeBytes),
  ].filter(Boolean);

  function changeWeek(next: number | null) {
    const previous = week;
    setWeek(next);
    startSaving(async () => {
      const result = await setFileWeek(file.id, next);
      if (result.ok) router.refresh(); // moves the file into its new week group
      else setWeek(previous);
    });
  }

  function togglePreview() {
    setOpen((o) => !o);
    if (!preview) {
      startLoadingPreview(async () => {
        const result = await getTextPreview(file.id);
        setPreview(result.ok ? { text: result.text, total: result.total } : { text: result.error, total: 0 });
      });
    }
  }

  return (
    <li className="rounded-xl border border-line bg-code px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <FileIcon className="size-5 shrink-0 text-faint" />
        <div className="min-w-0 flex-1 basis-44">
          <p className="truncate text-sm font-medium" title={file.filename}>
            {file.filename}
          </p>
          <p className="text-xs text-faint">
            {details.join(" · ")}
            {details.length > 0 && " · "}
            <Status file={file} />
          </p>
        </div>
        <div className="flex items-center gap-2">
          {file.status === "done" && (
            <button type="button" onClick={togglePreview} className="rounded-lg px-2 py-1.5 text-sm text-accent hover:bg-hover">
              {open ? "Hide text" : "View text"}
            </button>
          )}
          <WeekSelect value={week} onChange={changeWeek} disabled={saving} label={`Week for ${file.filename}`} />
        </div>
      </div>
      {file.error && <p className="mt-2 text-xs text-mastery-mid">{file.error}</p>}
      {open && (
        <div className="mt-3 rounded-lg border border-line bg-bg/40 p-3">
          {loadingPreview || !preview ? (
            <p className="text-sm text-faint">Loading…</p>
          ) : (
            <>
              <pre className="scroll-thin max-h-72 overflow-auto whitespace-pre-wrap font-sans text-xs leading-relaxed text-muted">
                {preview.text || "(no text)"}
              </pre>
              {preview.total > preview.text.length && (
                <p className="mt-2 text-xs text-faint">
                  Showing the first {preview.text.length.toLocaleString()} of {preview.total.toLocaleString()} characters.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </li>
  );
}

function Status({ file }: { file: SourceFile }) {
  switch (file.status) {
    case "pending":
      return <span>Waiting to be read</span>;
    case "extracting":
      return <span className="text-accent">Reading…</span>;
    case "failed":
      return <span className="text-mastery-low">Couldn&rsquo;t read</span>;
    case "done":
      return <span className="text-mastery-high">{(file.charCount ?? 0).toLocaleString()} characters of text</span>;
  }
}
