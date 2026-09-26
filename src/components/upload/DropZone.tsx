"use client";

import { useRef, useState } from "react";
import { UploadIcon } from "@/components/ui/icons";

type DropZoneProps = {
  title: string;
  description: string;
  onFiles: (files: File[]) => void;
  disabled?: boolean;
  children?: React.ReactNode;
};

/** A box you can drop files onto or tap to choose files. Accepts PDF, PPTX and DOCX. */
export function DropZone({ title, description, onFiles, disabled, children }: DropZoneProps) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  return (
    <section className="rounded-2xl border border-line bg-panel p-4 frost sm:p-5">
      <h2 className="font-display text-lg">{title}</h2>
      <p className="mt-1 text-sm text-muted">{description}</p>

      <button
        type="button"
        disabled={disabled}
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          if (!disabled) onFiles([...e.dataTransfer.files]);
        }}
        className={`mt-4 flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-7 text-center transition-colors disabled:opacity-50 ${
          over ? "border-accent bg-accent-soft" : "border-line hover:border-accent/50 hover:bg-hover"
        }`}
      >
        <UploadIcon className="size-6 text-accent" />
        <span className="font-medium">
          <span className="hidden sm:inline">Drop files here or </span>
          <span className="text-accent">choose files</span>
        </span>
        <span className="text-xs text-faint">PDF, PowerPoint (.pptx) or Word (.docx), up to 50 MB each</span>
      </button>
      <input
        ref={input}
        type="file"
        multiple
        accept=".pdf,.pptx,.docx,application/pdf"
        className="hidden"
        onChange={(e) => {
          onFiles([...(e.target.files ?? [])]);
          e.target.value = ""; // allow choosing the same file again after removing it
        }}
      />

      {children}
    </section>
  );
}
