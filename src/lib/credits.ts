import type { SupabaseClient } from "@supabase/supabase-js";
import type { Usage } from "@/lib/generation/claude";

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

export type AiFeature = "tutor" | "mark" | "fix";

/**
 * Records a paid Claude call's tokens and cost (ai_usage table, admin client). Never throws:
 * a logging failure mustn't break the feature.
 */
export async function logAiUsage(
  admin: SupabaseClient,
  entry: {
    userId: string;
    courseId: string | null;
    feature: AiFeature;
    model: string;
    usage: Usage;
    apiCostUsd: number;
    chargedUsd: number;
    durationMs?: number;
  },
): Promise<void> {
  const { usage } = entry;
  const { error } = await admin.from("ai_usage").insert({
    user_id: entry.userId,
    course_id: entry.courseId,
    feature: entry.feature,
    model: entry.model,
    input_tokens: usage.input_tokens,
    output_tokens: usage.output_tokens,
    cache_write_tokens: usage.cache_creation_input_tokens,
    cache_write_1h_tokens: usage.cache_creation_1h_input_tokens ?? 0,
    cache_read_tokens: usage.cache_read_input_tokens,
    api_cost_usd: entry.apiCostUsd,
    charged_usd: entry.chargedUsd,
    duration_ms: entry.durationMs ?? null,
  });
  if (error) console.warn(`usage log failed (${entry.feature}): ${error.message}`);
}
