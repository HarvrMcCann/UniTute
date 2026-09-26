"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { signOut } from "@/app/actions";

export type Account = { email: string | null; displayName: string | null };

export function AccountMenu({ account }: { account: Account | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  if (!account) {
    return (
      <Link
        href={`/login?next=${encodeURIComponent(pathname)}`}
        className="shrink-0 rounded-xl px-3 py-2 text-sm font-medium text-accent transition-colors hover:bg-hover"
      >
        Sign in
      </Link>
    );
  }

  const name = account.displayName || account.email || "You";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Account"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="grid size-10 place-items-center rounded-xl transition-colors hover:bg-hover"
      >
        <span className="grid size-7 place-items-center rounded-full bg-accent-soft text-sm font-semibold text-accent">
          {name.charAt(0).toUpperCase()}
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-12 z-50 w-64 rounded-2xl border border-line bg-panel-strong p-2 shadow-xl frost"
          >
            <div className="px-3 py-2">
              <p className="truncate font-medium">{name}</p>
              {account.email && account.email !== name && (
                <p className="truncate text-sm text-muted">{account.email}</p>
              )}
            </div>
            <div className="my-1 h-px bg-line" />
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await signOut();
                  setOpen(false);
                  router.refresh();
                })
              }
              className="w-full rounded-xl px-3 py-2 text-left text-sm text-muted transition-colors hover:bg-hover hover:text-text disabled:opacity-50"
            >
              {pending ? "Signing out…" : "Sign out"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
