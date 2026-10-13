import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SimpleHeader } from "@/components/ui/SimpleHeader";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Join a course · UniTute" };

/**
 * A course's share link. Signed-in visitors become members (their own progress, mastery and tutor
 * chat) and land in the course; everyone else signs in first and comes back here.
 */
export default async function JoinPage({ params }: PageProps<"/join/[token]">) {
  const { token } = await params;
  const user = await getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/join/${token}`)}`);

  // The token is checked with the secret key: the course isn't readable to this user until they join.
  const admin = createAdminClient();
  const { data: course } = await admin
    .from("courses")
    .select("id, owner_id, status")
    .eq("share_token", token)
    .maybeSingle();

  if (course && course.status === "ready") {
    if (course.owner_id !== user.id) {
      await admin.from("course_members").upsert({ course_id: course.id, user_id: user.id }, { ignoreDuplicates: true });
    }
    redirect(`/course/${course.id}`);
  }

  return (
    <div className="mx-auto min-h-dvh max-w-md px-4 sm:px-6">
      <SimpleHeader />
      <main className="pt-16 text-center">
        <h1 className="font-display text-2xl">This link doesn&rsquo;t work</h1>
        <p className="mt-3 text-muted">
          The course may have stopped sharing, or the link was copied wrong. Ask whoever shared it for a new one.
        </p>
        <Link href="/" className="mt-6 inline-block text-accent hover:underline">
          Go to your courses
        </Link>
      </main>
    </div>
  );
}
