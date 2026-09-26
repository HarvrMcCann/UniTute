"use client";

import { useLinkStatus } from "next/link";

/**
 * Place inside a <Link> (which needs `relative overflow-hidden`): shows a shimmer across
 * the link while its page loads, so a slow tap never looks ignored.
 */
export function LinkPending() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
      <span className="pending-sweep absolute inset-0" />
    </span>
  );
}
