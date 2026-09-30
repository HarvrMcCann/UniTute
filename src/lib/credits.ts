import type { SupabaseClient } from "@supabase/supabase-js";

/*
 * Prepaid credit for AI features (AI marking now; the tutor, interactive fixes and course changes
 * later). Balances are in US dollars as the user sees them: a $2.00 top-up buys about $1.50 of
 * actual Claude usage, so each call is charged at its API cost times CREDIT_MARKUP.
 * Balances only change on the server, through the adjust_credit database function.
 */

export const CREDIT_MARKUP = 2 / 1.5;

/** Below this, AI features are unavailable (a single AI mark costs well under a cent). */
export const MIN_CREDIT_USD = 0.005;

/** The user's balance, read with their own client (RLS: own profile only). */
export async function getCredit(supabase: SupabaseClient, userId: string): Promise<number> {
  const { data } = await supabase.from("profiles").select("credit_usd").eq("id", userId).maybeSingle();
  return data ? Number(data.credit_usd) : 0;
}

/**
 * Adds (positive) or spends (negative) credit with the admin client. Spending never goes below
 * zero. Returns the new balance, or null if it couldn't be recorded.
 */
export async function adjustCredit(admin: SupabaseClient, userId: string, deltaUsd: number, reason: string): Promise<number | null> {
  const { data, error } = await admin.rpc("adjust_credit", { p_user: userId, p_delta: deltaUsd, p_reason: reason.slice(0, 200) });
  if (error) {
    console.warn(`credit change failed (${reason}): ${error.message}`);
    return null;
  }
  return data === null ? null : Number(data);
}

/** What a Claude call costs the user, given its API cost. */
export const creditCost = (apiCostUsd: number) => apiCostUsd * CREDIT_MARKUP;

export const formatCredit = (usd: number) => `$${usd.toFixed(2)}`;
