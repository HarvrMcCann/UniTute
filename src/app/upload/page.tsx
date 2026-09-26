import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SimpleHeader } from "@/components/ui/SimpleHeader";
import { UploadForm } from "@/components/upload/UploadForm";
import { getProfile, getUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "New course · UniTute" };

export default async function UploadPage() {
  const user = await getUser();
  if (!user) redirect("/login?next=/upload");
  const profile = await getProfile();

  return (
    <div className="mx-auto min-h-dvh max-w-3xl px-4 sm:px-6">
      <SimpleHeader account={{ email: user.email, displayName: profile?.displayName ?? null }} />
      <main className="pt-6 sm:pt-10">
        <h1 className="font-display text-3xl font-medium tracking-tight sm:text-4xl">New course</h1>
        <p className="mt-2 max-w-[60ch] text-muted">
          Add your unit&rsquo;s files. We&rsquo;ll match each one to a week from its name; check the weeks before
          uploading. Your files stay private to you.
        </p>
        <div className="mt-8">
          <UploadForm />
        </div>
      </main>
    </div>
  );
}
