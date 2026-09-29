import type { Relevance } from "@/lib/course/schema";

export const RELEVANCE_LABEL: Record<Relevance, string> = {
  core: "In your objectives",
  supporting: "Background",
  extension: "Beyond your objectives",
};

export const RELEVANCE_HINT: Record<Relevance, string> = {
  core: "Directly taught or tested by your unit's objectives",
  supporting: "Needed to understand objective topics, but not asked for itself",
  extension: "Covered in the lectures, but your objectives don't ask for it",
};

const STYLE: Record<Relevance, string> = {
  core: "border-accent/40 bg-accent-soft text-accent",
  supporting: "border-line bg-panel text-muted",
  extension: "border-dashed border-line text-faint",
};

/** How a lesson or section relates to the course's objectives. */
export function RelevanceBadge({ relevance, className = "" }: { relevance: Relevance; className?: string }) {
  return (
    <span
      title={RELEVANCE_HINT[relevance]}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 align-middle font-sans text-xs font-medium tracking-normal ${STYLE[relevance]} ${className}`}
    >
      <span
        aria-hidden
        className={`size-1.5 rounded-full ${relevance === "core" ? "bg-accent" : relevance === "supporting" ? "bg-muted" : "border border-faint"}`}
      />
      {RELEVANCE_LABEL[relevance]}
    </span>
  );
}
