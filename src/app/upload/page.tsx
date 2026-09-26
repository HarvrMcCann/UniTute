import type { Metadata } from "next";
import { SimpleHeader } from "@/components/ui/SimpleHeader";
import { UploadForm } from "@/components/upload/UploadForm";
import { getProfile, getUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "New course · UniTute" };

/** Open to everyone: picking files and weeks needs no account; uploading does (see UploadForm). */
export default async function UploadPage({ searchParams }: PageProps<"/upload">) {
  const [user, profile, params] = await Promise.all([getUser(), getProfile(), searchParams]);

  return (
    <div className="mx-auto min-h-dvh max-w-3xl px-4 sm:px-6">
      <SimpleHeader account={user ? { email: user.email, displayName: profile?.displayName ?? null } : null} />
      <main className="pt-6 sm:pt-10">
        <h1 className="font-display text-3xl font-medium tracking-tight sm:text-4xl">New course</h1>
        <p className="mt-2 max-w-[60ch] text-muted">
          Add your unit&rsquo;s files. We&rsquo;ll match each one to a week from its name; check the weeks before
          uploading. Your files stay private to you.
        </p>
        <div className="mt-8">
          <UploadForm signedIn={user !== null} resume={params.resume === "1"} />
        </div>
      </main>
    </div>
  );
}
