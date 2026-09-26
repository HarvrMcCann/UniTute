import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/LoginForm";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { safeNext } from "@/lib/safeNext";
import { getUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Sign in · UniTute" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = safeNext(typeof params.next === "string" ? params.next : null);
  if (await getUser()) redirect(next);

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-4 sm:px-6">
      <header className="flex items-center justify-between py-4">
        <Link href="/" className="font-display text-xl font-semibold tracking-tight">
          UniTute
        </Link>
        <ThemeToggle />
      </header>
      <main className="flex flex-1 flex-col justify-center pb-24">
        <h1 className="font-display text-3xl font-medium tracking-tight">Sign in</h1>
        <p className="mt-2 text-muted">Save your progress and pick up on any device.</p>
        {params.error === "link" && (
          <p role="alert" className="mt-5 rounded-xl bg-mastery-low/12 px-4 py-3 text-sm text-mastery-low">
            That sign-in link didn&rsquo;t work. It may have expired or already been used. Request a new one below.
          </p>
        )}
        <LoginForm next={next} />
      </main>
    </div>
  );
}
