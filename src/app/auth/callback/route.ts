import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/safe-redirect";

/**
 * Handles links from Supabase Auth emails and OAuth:
 *   - PKCE / OAuth:      ?code=...
 *   - Email templates:   ?token_hash=...&type=signup|recovery|email_change|...
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNextPath(searchParams.get("next"));
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const supabase = await createClient();
  let error: { code?: string; message: string } | null = { message: "missing code or token_hash" };

  if (code) {
    // PKCE (Supabase's default email links): only works in the browser that asked for the email.
    ({ error } = await supabase.auth.exchangeCodeForSession(code));
  } else if (tokenHash && type) {
    ({ error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash }));
  }
  if (!error) return NextResponse.redirect(new URL(next, origin));

  console.error("[auth] callback failed", {
    flow: code ? "pkce" : "token_hash",
    type,
    code: error.code,
    message: error.message,
  });
  // A failed reset link: straight to asking for a new one.
  const failed =
    next === "/reset-password" || type === "recovery" ? "/forgot-password?error=link" : "/login?error=link";
  return NextResponse.redirect(new URL(failed, origin));
}
