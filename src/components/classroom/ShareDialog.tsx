"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { setShareLink } from "@/app/actions";
import { IconButton } from "@/components/ui/IconButton";
import { CloseIcon, ShareIcon } from "@/components/ui/icons";

type ShareDialogProps = {
  courseId: string;
  initialToken: string | null;
  memberCount: number;
  reportCount: number;
};

/** Owner-only: a link classmates open to join the course, and where their problem reports go. */
export function ShareDialog({ courseId, initialToken, memberCount, reportCount }: ShareDialogProps) {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState(initialToken);
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();
  const url = token ? `${typeof window === "undefined" ? "" : window.location.origin}/join/${token}` : null;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function change(enabled: boolean) {
    setFailed(false);
    startTransition(async () => {
      const result = await setShareLink(courseId, enabled);
      if (!result) return setFailed(true);
      setToken(result.token);
      setCopied(false);
    });
  }

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked: the link is selectable in the box
    }
  }

  return (
    <>
      <IconButton label="Share course" onClick={() => setOpen(true)}>
        <ShareIcon />
      </IconButton>
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 grid place-items-center p-4">
            <motion.div
              className="absolute inset-0 bg-scrim"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Share this course"
              className="relative w-full max-w-md rounded-2xl border border-line bg-panel-solid p-5"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.2 }}
            >
              <div className="absolute right-2 top-2">
                <IconButton label="Close" size="sm" onClick={() => setOpen(false)}>
                  <CloseIcon />
                </IconButton>
              </div>
              <h2 className="font-display text-xl">Share this course</h2>
              <p className="mt-2 text-sm text-muted">
                Anyone with the link can sign in and study it, with their own progress, knowledge level and tutor. They
                can&rsquo;t change the course.
              </p>

              {url ? (
                <>
                  <div className="mt-4 flex gap-2">
                    <input
                      readOnly
                      value={url}
                      onFocus={(e) => e.currentTarget.select()}
                      aria-label="Share link"
                      className="min-w-0 flex-1 rounded-lg border border-line bg-code px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      onClick={copy}
                      className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-contrast transition active:scale-[0.97]"
                    >
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => change(false)}
                    className="mt-3 text-sm text-muted hover:text-text disabled:opacity-50"
                  >
                    Turn off the link
                  </button>
                  <p className="mt-1 text-xs text-faint">People who already joined keep access.</p>
                </>
              ) : (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => change(true)}
                  className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-contrast transition active:scale-[0.97] disabled:opacity-50"
                >
                  {pending ? "Creating…" : "Create a share link"}
                </button>
              )}
              {failed && <p className="mt-2 text-sm text-mastery-low">That didn&rsquo;t work. Try again.</p>}

              <div className="mt-5 flex flex-wrap justify-between gap-2 border-t border-line pt-4 text-sm text-muted">
                <span>
                  {memberCount} {memberCount === 1 ? "person has" : "people have"} joined
                </span>
                <Link href={`/course/${courseId}/reports`} onClick={() => setOpen(false)} className="text-accent hover:underline">
                  Problem reports{reportCount ? ` (${reportCount})` : ""}
                </Link>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
