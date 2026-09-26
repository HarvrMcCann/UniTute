"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/browser";

type Status = { kind: "idle" } | { kind: "sending" } | { kind: "sent"; email: string } | { kind: "error"; message: string };

export function LoginForm({ next }: { next: string }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const callbackUrl = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setStatus({ kind: "sending" });
    const { error } = await createClient().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: callbackUrl() },
    });
    setStatus(error ? { kind: "error", message: error.message } : { kind: "sent", email: email.trim() });
  }

  async function signInWithGoogle() {
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl() },
    });
    if (error) setStatus({ kind: "error", message: error.message });
  }

  if (status.kind === "sent") {
    return (
      <div className="mt-8 rounded-2xl border border-line bg-panel p-5 frost">
        <p className="font-display text-lg">Check your email</p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          We sent a sign-in link to <span className="text-text">{status.email}</span>. Open it on this device or any
          other. It expires in an hour.
        </p>
        <button
          type="button"
          onClick={() => setStatus({ kind: "idle" })}
          className="mt-4 text-sm text-accent hover:underline"
        >
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-5">
      <button
        type="button"
        onClick={signInWithGoogle}
        className="flex w-full items-center justify-center gap-3 rounded-xl border border-line bg-panel px-4 py-3 font-medium frost transition-colors hover:bg-hover"
      >
        <GoogleMark />
        Continue with Google
      </button>

      <div className="flex items-center gap-3 text-xs uppercase tracking-wider text-faint">
        <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
      </div>

      <form onSubmit={sendMagicLink} className="space-y-3">
        <label htmlFor="email" className="block text-sm text-muted">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@uni.edu.au"
          className="w-full rounded-xl border border-line bg-code px-4 py-3 text-base outline-none transition-colors placeholder:text-faint focus:border-accent"
        />
        <button
          type="submit"
          disabled={status.kind === "sending"}
          className="w-full rounded-xl bg-accent px-4 py-3 font-medium text-accent-contrast transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {status.kind === "sending" ? "Sending…" : "Email me a sign-in link"}
        </button>
      </form>

      {status.kind === "error" && (
        <p role="alert" className="text-sm text-mastery-low">
          {status.message}
        </p>
      )}
    </div>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
