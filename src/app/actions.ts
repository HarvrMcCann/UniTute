"use server";

import { revalidatePath } from "next/cache";
import type { Theme } from "@/lib/theme";
import { createClient, getUser } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
}

/** Remembers the theme on the profile when signed in (the browser keeps it in localStorage too). */
export async function saveTheme(theme: Theme) {
  if (theme !== "dark" && theme !== "light") return;
  const user = await getUser();
  if (!user) return;
  const supabase = await createClient();
  await supabase.from("profiles").update({ theme }).eq("id", user.id);
}
