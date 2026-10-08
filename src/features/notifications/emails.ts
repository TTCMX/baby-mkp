import "server-only";
import { after } from "next/server";
import { emailEnabled, sendEmail } from "@/lib/email";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { createAdminClient } from "@/lib/supabase/admin";
import { notificationEmail } from "./email-template";

/**
 * Emails the notifications nobody has emailed yet. Call it (in `after()`) from
 * any server path that may create notifications; the daily cron sweeps the rest.
 * Safe to run concurrently: rows are claimed with SKIP LOCKED.
 */
export async function flushNotificationEmails(limit = 50): Promise<{ sent: number; failed: number }> {
  if (!emailEnabled()) return { sent: 0, failed: 0 };
  const db = createAdminClient();
  const { data, error } = await db.rpc("claim_notification_emails", { p_limit: limit });
  if (error) {
    console.error("[email] claim failed", error);
    return { sent: 0, failed: 0 };
  }
  let sent = 0;
  let failed = 0;
  for (const n of data ?? []) {
    try {
      await sendEmail({
        to: n.email,
        ...notificationEmail({
          displayName: n.display_name,
          title: n.title,
          body: n.body,
          link: n.link,
          siteUrl: SITE_URL,
          siteName: SITE_NAME,
        }),
      });
      sent++;
    } catch (err) {
      failed++;
      console.error("[email] send failed", n.id, err);
      await db.rpc("release_notification_email", { p_id: n.id });
    }
  }
  return { sent, failed };
}

/** Emails whatever the current request notified, after the response is sent. */
export function emailNotificationsSoon() {
  after(() => flushNotificationEmails());
}
