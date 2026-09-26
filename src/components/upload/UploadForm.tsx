"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createDraftCourse, registerFiles, type UploadedFile } from "@/app/upload/actions";
import { LoginForm } from "@/components/auth/LoginForm";
import { IconButton } from "@/components/ui/IconButton";
import { clearDraft, loadDraft, saveDraft } from "@/lib/upload/draftStore";
import { createClient } from "@/lib/supabase/browser";
import { deriveTitle } from "@/lib/upload/deriveTitle";
import { guessWeek } from "@/lib/upload/guessWeek";
import { ChevronIcon, CloseIcon } from "@/components/ui/icons";
import { countPages, kindOf, MIME_TYPES, rejectReason, type FileKind } from "@/lib/upload/inspectFile";
import { DropZone } from "./DropZone";
import { FileRow, type UploadState } from "./FileRow";

type Box = "content" | "objectives";

type PickedFile = {
  id: string;
  file: File;
  box: Box;
  kind: FileKind;
  week: number | null;
  /** undefined while counting */
  pages: number | null | undefined;
  note?: string;
  upload?: UploadState;
};

type Phase =
  | { kind: "editing" }
  | { kind: "working"; label: string }
  | { kind: "error"; message: string };

const UPLOAD_CONCURRENCY = 3;

const byWeekThenName = (a: PickedFile, b: PickedFile) =>
  (a.week ?? 99) - (b.week ?? 99) || a.file.name.localeCompare(b.file.name, undefined, { numeric: true });

type UploadFormProps = {
  signedIn: boolean;
  /** Back from signing in with Google: restore the files saved before leaving. */
  resume: boolean;
};

export function UploadForm({ signedIn: initiallySignedIn, resume }: UploadFormProps) {
  const router = useRouter();
  const [signedIn, setSignedIn] = useState(initiallySignedIn);
  const [authOpen, setAuthOpen] = useState(false);
  const [restored, setRestored] = useState(false);
  const [title, setTitle] = useState("");
  const [courseCode, setCourseCode] = useState("");
  const [university, setUniversity] = useState("");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [rejected, setRejected] = useState<{ name: string; reason: string }[]>([]);
  const [phase, setPhase] = useState<Phase>({ kind: "editing" });
  const [course, setCourse] = useState<{ courseId: string; userId: string } | null>(null);

  // Returning from Google sign-in: put the saved files and choices back.
  useEffect(() => {
    if (!resume) return;
    void loadDraft().then((draft) => {
      if (!draft) return;
      setTitle(draft.title);
      setCourseCode(draft.courseCode);
      setUniversity(draft.university);
      setYear(draft.year);
      setNotes(draft.notes);
      setFiles(draft.files.map((f) => ({ ...f, kind: kindOf(f.file.name)! })));
      setRestored(true);
    });
  }, [resume]);

  function saveForLater() {
    return saveDraft({
      title,
      courseCode,
      university,
      year,
      notes,
      files: files.map(({ id, file, box, week, pages, note }) => ({ id, file, box, week, pages, note })),
    }).then(() => undefined);
  }

  const busy = phase.kind === "working";
  const locked = busy || course !== null; // once the course exists, the file list is fixed
  const update = (id: string, patch: Partial<PickedFile>) =>
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));

  function addFiles(box: Box, list: File[]) {
    const bad: { name: string; reason: string }[] = [];
    const added: PickedFile[] = [];
    for (const file of list) {
      const reason = rejectReason(file);
      if (reason) {
        bad.push({ name: file.name, reason });
        continue;
      }
      const all = [...files, ...added];
      if (all.some((f) => f.file.name === file.name && f.file.size === file.size)) continue; // exact duplicate
      const lookalike = all.find((f) => f.file.size === file.size);
      added.push({
        id: crypto.randomUUID(),
        file,
        box,
        kind: kindOf(file.name)!,
        week: guessWeek(file.name),
        pages: undefined,
        note: lookalike ? `same size as "${lookalike.file.name}", possible duplicate` : undefined,
      });
    }
    setRejected(bad);
    setFiles((prev) => [...prev, ...added]);
    for (const f of added) void countPages(f.file, f.kind).then((pages) => update(f.id, { pages }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!files.some((f) => f.box === "content"))
      return setPhase({ kind: "error", message: "Add at least one file of lecture content." });
    // Everything up to here works signed out; an account is needed before anything is uploaded.
    // (Version 2: payment for processing is requested at this same point.)
    if (!signedIn) return setAuthOpen(true);
    void processFiles();
  }

  async function processFiles() {
    // 1. Create the course (only once, so retries reuse it)
    let ctx = course;
    if (!ctx) {
      setPhase({ kind: "working", label: "Creating your course…" });
      const created = await createDraftCourse({
        title: title.trim() || suggestedTitle,
        courseCode,
        university,
        year: year ? Number(year) : null,
        notes,
      });
      if (!created.ok) return setPhase({ kind: "error", message: created.error });
      ctx = { courseId: created.courseId, userId: created.userId };
      setCourse(ctx);
    }

    // 2. Upload straight from the browser to storage (skipping ones already done)
    const supabase = createClient();
    const todo = files.filter((f) => f.upload !== "done");
    let finished = files.length - todo.length;
    const failed: string[] = [];
    const pathOf = (f: PickedFile) => `${ctx.userId}/${ctx.courseId}/${f.id}.${f.kind}`;

    setPhase({ kind: "working", label: `Uploading ${finished} of ${files.length}…` });
    const queue = [...todo];
    await Promise.all(
      Array.from({ length: UPLOAD_CONCURRENCY }, async () => {
        for (let f = queue.shift(); f; f = queue.shift()) {
          update(f.id, { upload: "uploading" });
          const { error } = await supabase.storage
            .from("source-files")
            .upload(pathOf(f), f.file, { contentType: MIME_TYPES[f.kind], upsert: true });
          if (error) failed.push(f.id);
          update(f.id, { upload: error ? "failed" : "done" });
          finished += error ? 0 : 1;
          setPhase({ kind: "working", label: `Uploading ${finished} of ${files.length}…` });
        }
      }),
    );
    if (failed.length) {
      return setPhase({
        kind: "error",
        message: `${failed.length} file${failed.length === 1 ? "" : "s"} didn't upload. Check your connection and press Try again.`,
      });
    }

    // 3. Record the files and start text extraction
    setPhase({ kind: "working", label: "Starting text extraction…" });
    const registered = await registerFiles(
      ctx.courseId,
      files.map(
        (f): UploadedFile => ({
          id: f.id,
          box: f.box,
          week: f.week,
          filename: f.file.name,
          kind: f.kind,
          pageCount: f.pages ?? null,
          sizeBytes: f.file.size,
          storagePath: pathOf(f),
        }),
      ),
    );
    if (!registered.ok) return setPhase({ kind: "error", message: registered.error });
    await clearDraft();
    router.push(`/upload/${ctx.courseId}`);
  }

  const suggestedTitle = deriveTitle(files.filter((f) => f.box === "content").map((f) => f.file.name));
  const detailsSummary = [title.trim() || null, courseCode.trim() || null].filter(Boolean).join(" · ");

  const boxFiles = (box: Box) => files.filter((f) => f.box === box).sort(byWeekThenName);
  const noWeek = files.filter((f) => f.box === "content" && f.week === null).length;

  const renderList = (box: Box) =>
    boxFiles(box).length > 0 && (
      <ul className="mt-4 space-y-2">
        {boxFiles(box).map((f) => (
          <FileRow
            key={f.id}
            name={f.file.name}
            kind={f.kind}
            sizeBytes={f.file.size}
            pages={f.pages}
            week={f.week}
            note={f.note}
            locked={locked}
            upload={f.upload}
            onWeekChange={(week) => update(f.id, { week })}
            onRemove={() => setFiles((prev) => prev.filter((p) => p.id !== f.id))}
          />
        ))}
      </ul>
    );

  const input =
    "w-full rounded-xl border border-line bg-code px-3.5 py-2.5 text-base outline-none transition-colors placeholder:text-faint focus:border-accent disabled:opacity-60";

  return (
    <form onSubmit={submit} className="space-y-5">
      {restored && (
        <p role="status" className="rounded-xl bg-accent-soft px-4 py-3 text-sm">
          {signedIn ? "You’re signed in and your" : "Your"} files are back. Press{" "}
          <span className="font-medium">Upload</span> to continue.
        </p>
      )}
      <DropZone
        title="Lecture content"
        description="Lecture slides, readings and tutorial sheets. This is what your lessons are built from."
        onFiles={(list) => addFiles("content", list)}
        disabled={locked}
      >
        {renderList("content")}
        {noWeek > 0 && (
          <p className="mt-3 text-sm text-mastery-mid">
            {noWeek} file{noWeek === 1 ? " has" : "s have"} no week. Pick one if it belongs to a particular week,
            or leave it for material that covers the whole unit.
          </p>
        )}
      </DropZone>

      <DropZone
        title="Learning objectives (optional)"
        description="Unit outline, learning outcomes or past exams. Used to decide what to emphasise, never copied into lessons."
        onFiles={(list) => addFiles("objectives", list)}
        disabled={locked}
      >
        {renderList("objectives")}
      </DropZone>

      <section className="rounded-2xl border border-line bg-panel p-4 frost sm:p-5">
        <label className="block">
          <span className="font-display text-lg">Anything else? (optional)</span>
          <span className="mt-1 block text-sm text-muted">
            For example: &ldquo;The exam only covers weeks 3–7&rdquo; or &ldquo;I find Bode plots hard.&rdquo;
          </span>
          <textarea className={`${input} mt-3 min-h-24 resize-y`} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={locked} />
        </label>
      </section>

      {/* Optional and closed by default: everything here has a sensible default */}
      <details className="group rounded-2xl border border-line bg-panel frost">
        <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 sm:px-5 [&::-webkit-details-marker]:hidden">
          <ChevronIcon className="size-4 shrink-0 text-faint transition-transform group-open:rotate-90" />
          <span className="font-display text-lg">Course details</span>
          <span className="min-w-0 flex-1 truncate text-right text-sm text-faint">
            {detailsSummary || "Optional"}
          </span>
        </summary>
        <div className="grid gap-3 px-4 pb-5 sm:grid-cols-2 sm:px-5">
          <label className="block sm:col-span-2">
            <span className="text-sm text-muted">Course name</span>
            <input
              className={`${input} mt-1`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={suggestedTitle}
              disabled={locked}
            />
            <span className="mt-1 block text-xs text-faint">Leave blank to use the name shown, taken from your files.</span>
          </label>
          <label className="block">
            <span className="text-sm text-muted">Course code</span>
            <input className={`${input} mt-1`} value={courseCode} onChange={(e) => setCourseCode(e.target.value)} placeholder="ENGR2722" disabled={locked} />
          </label>
          <label className="block">
            <span className="text-sm text-muted">Year</span>
            <input className={`${input} mt-1`} value={year} onChange={(e) => setYear(e.target.value.replace(/D/g, "").slice(0, 4))} inputMode="numeric" disabled={locked} />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-sm text-muted">University</span>
            <input className={`${input} mt-1`} value={university} onChange={(e) => setUniversity(e.target.value)} placeholder="Flinders University" disabled={locked} />
          </label>
        </div>
      </details>

      {rejected.length > 0 && (
        <div role="alert" className="rounded-xl bg-mastery-low/10 px-4 py-3 text-sm">
          <p className="font-medium text-mastery-low">Some files weren&rsquo;t added:</p>
          <ul className="mt-1 space-y-0.5 text-muted">
            {rejected.map((r) => (
              <li key={r.name}>
                <span className="text-text">{r.name}</span>: {r.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 pb-10">
        <button
          type="submit"
          disabled={busy || files.length === 0}
          className="rounded-xl bg-accent px-5 py-3 font-medium text-accent-contrast transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {phase.kind === "working"
            ? phase.label
            : course
              ? "Try again"
              : `Upload ${files.length || ""} file${files.length === 1 ? "" : "s"}`}
        </button>
        {phase.kind === "error" && (
          <p role="alert" className="text-sm text-mastery-low">
            {phase.message}
          </p>
        )}
      </div>

      {authOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
          <div className="absolute inset-0 bg-scrim" onClick={() => setAuthOpen(false)} />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-title"
            className="relative max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-line bg-panel-solid p-5 shadow-2xl sm:rounded-3xl sm:p-6"
          >
            <div className="absolute right-3 top-3">
              <IconButton label="Close" size="sm" onClick={() => setAuthOpen(false)}>
                <CloseIcon />
              </IconButton>
            </div>
            <h2 id="auth-title" className="pr-10 font-display text-2xl">
              Create your free account
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Your {files.length} file{files.length === 1 ? " is" : "s are"} ready. Sign in or create an account so we can
              process {files.length === 1 ? "it" : "them"} and save your course and progress.
            </p>
            <LoginForm
              next="/upload?resume=1"
              beforeLeave={saveForLater}
              onSignedIn={() => {
                setSignedIn(true);
                setAuthOpen(false);
                void processFiles();
              }}
            />
          </div>
        </div>
      )}
    </form>
  );
}
