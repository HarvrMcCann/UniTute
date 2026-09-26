import { IconButton } from "@/components/ui/IconButton";
import { FileIcon, TrashIcon } from "@/components/ui/icons";
import type { FileKind } from "@/lib/upload/inspectFile";
import { WeekSelect } from "./WeekSelect";

export type UploadState = "waiting" | "uploading" | "done" | "failed";

type FileRowProps = {
  name: string;
  kind: FileKind;
  sizeBytes: number;
  /** undefined while still counting */
  pages: number | null | undefined;
  week: number | null;
  onWeekChange: (week: number | null) => void;
  onRemove: () => void;
  locked: boolean;
  upload?: UploadState;
  note?: string;
};

const KIND_LABEL: Record<FileKind, string> = { pdf: "PDF", pptx: "Slides", docx: "Word" };

export function formatSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function FileRow({ name, kind, sizeBytes, pages, week, onWeekChange, onRemove, locked, upload, note }: FileRowProps) {
  const unit = kind === "pptx" ? "slide" : "page";
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-line bg-code px-3 py-2.5">
      <FileIcon className="size-5 shrink-0 text-faint" />
      <div className="min-w-0 flex-1 basis-40">
        <p className="truncate text-sm font-medium" title={name}>
          {name}
        </p>
        <p className="text-xs text-faint">
          {KIND_LABEL[kind]} · {formatSize(sizeBytes)} ·{" "}
          {pages === undefined ? "counting…" : pages === null ? `? ${unit}s` : `${pages} ${unit}${pages === 1 ? "" : "s"}`}
          {note && <span className="text-mastery-mid"> · {note}</span>}
        </p>
      </div>
      <div className="flex items-center gap-1">
        {upload ? (
          <UploadBadge state={upload} />
        ) : (
          <>
            <WeekSelect value={week} onChange={onWeekChange} disabled={locked} label={`Week for ${name}`} />
            <IconButton label={`Remove ${name}`} size="sm" onClick={onRemove} disabled={locked}>
              <TrashIcon className="size-4" />
            </IconButton>
          </>
        )}
      </div>
    </li>
  );
}

function UploadBadge({ state }: { state: UploadState }) {
  const styles: Record<UploadState, string> = {
    waiting: "text-faint",
    uploading: "text-accent",
    done: "text-mastery-high",
    failed: "text-mastery-low",
  };
  const labels: Record<UploadState, string> = {
    waiting: "Waiting",
    uploading: "Uploading…",
    done: "Uploaded",
    failed: "Failed",
  };
  return <span className={`px-2 text-sm ${styles[state]}`}>{labels[state]}</span>;
}
