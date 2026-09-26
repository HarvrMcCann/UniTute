import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/safeNext";
import { createClient } from "@/lib/supabase/server";

/**
 * Where every sign-in lands:
 * - Magic links (token_hash): works even if the email is opened in a different browser
 *   or app from the one that asked. Email template link:
 *   {{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email
 * - Google, and magic links from the default template, arrive with a one-time `code`.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNext(searchParams.get("next"));
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");

  const supabase = await createClient();
  const { error } =
    tokenHash && type
      ? await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
      : code
        ? await supabase.auth.exchangeCodeForSession(code)
        : { error: new Error("missing token") };

  return NextResponse.redirect(new URL(error ? "/login?error=link" : next, origin));
}
