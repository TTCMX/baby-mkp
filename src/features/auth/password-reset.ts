import "server-only";
import { passwordResetEmail } from "@/features/notifications/email-template";
import { sendEmail } from "@/lib/email";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { createAdminClient } from "@/lib/supabase/admin";

export type ResetResult = "sent" | "skipped" | "rate_limited";

/**
 * Emails a password-reset link built from Supabase's hashed token. Unlike the
 * default Supabase email (PKCE), the link works in any browser or device: it
 * doesn't depend on the dashboard templates nor on the browser that asked.
 * "skipped" (no such account) is reported to the user like "sent".
 */
export async function sendPasswordReset(email: string): Promise<ResetResult> {
  const db = createAdminClient();
  const { data: allowed, error: limitError } = await db.rpc("allow_password_reset", { p_email: email });
  if (limitError) throw limitError;
  if (!allowed) return "rate_limited";

  const { data, error } = await db.auth.admin.generateLink({ type: "recovery", email });
  if (error || !data.properties?.hashed_token) {
    // Unknown email (or a user that can't sign in): nothing to send.
    if (error && error.status !== 404 && error.code !== "user_not_found") console.error("[auth] reset link", error);
    return "skipped";
  }
  const url = `${SITE_URL}/auth/callback?token_hash=${encodeURIComponent(data.properties.hashed_token)}&type=recovery&next=/reset-password`;
  await sendEmail({ to: email, ...passwordResetEmail({ url, siteName: SITE_NAME }) });
  return "sent";
}
