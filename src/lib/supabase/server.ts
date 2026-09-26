import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./env";

/**
 * Supabase client for server components, route handlers and server actions.
 * Acts as the signed-in user (from cookies), so RLS applies. One per request.
 */
export const createClient = cache(async () => {
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server components can't set cookies; proxy.ts refreshes the session instead.
        }
      },
    },
  });
});

export type SessionUser = { id: string; email: string | null };

/** The signed-in user, verified against the session's signature, or null. Cached per request. */
export const getUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : null };
});

export type Profile = { displayName: string | null; theme: "dark" | "light" };

export const getProfile = cache(async (): Promise<Profile | null> => {
  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("display_name, theme").eq("id", user.id).maybeSingle();
  if (!data) return null;
  return { displayName: data.display_name, theme: data.theme === "light" ? "light" : "dark" };
});
