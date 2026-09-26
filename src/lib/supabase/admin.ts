import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase client with the SECRET key: bypasses row level security.
 * Server-only scripts and background jobs (seeding, course generation). Never import from app code
 * that could reach the browser.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local");
  return createSupabaseClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
}
