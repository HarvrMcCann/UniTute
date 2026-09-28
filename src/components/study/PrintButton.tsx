"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-xl border border-line px-4 py-2 text-sm text-muted transition-colors hover:bg-hover hover:text-text print:hidden"
    >
      Print
    </button>
  );
}
