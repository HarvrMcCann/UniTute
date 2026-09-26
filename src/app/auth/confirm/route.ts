import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/safeNext";
import { createClient } from "@/lib/supabase/server";

/**
 * Magic-link landing (token_hash flow). Works even when the email is opened in a
 * different browser or app from the one that asked for it.
 * Email template link: {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next={{ .RedirectTo }}
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNext(nextPath(searchParams.get("next"), origin));

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, origin));
  }
  return NextResponse.redirect(new URL("/login?error=link", origin));
}

/**
 * `next` arrives as {{ .RedirectTo }}: the full /auth/callback?next=... URL the login page
 * asked for (so the default template also works). Unwrap it to the final same-origin path.
 */
function nextPath(next: string | null, origin: string): string | null {
  if (!next) return null;
  try {
    const url = new URL(next, origin);
    if (url.origin !== origin) return null;
    if (url.pathname === "/auth/callback") return url.searchParams.get("next");
    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}
