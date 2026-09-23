import "server-only";
import { publicEnv } from "@/lib/env";
import type { AnalyticsEvent, AnalyticsProperties } from "./events";

/**
 * Server-side event capture through PostHog's HTTP API (no SDK needed).
 * Business events (orders, payments, payouts) are tracked server-side so
 * they cannot be blocked or spoofed by the browser. Never throws.
 */
export async function track(event: AnalyticsEvent, distinctId: string, properties: AnalyticsProperties = {}) {
  const env = publicEnv();
  if (!env.NEXT_PUBLIC_POSTHOG_KEY) {
    if (process.env.NODE_ENV === "development") console.info("[analytics]", event, distinctId, properties);
    return;
  }
  try {
    await fetch(`${env.NEXT_PUBLIC_POSTHOG_HOST}/capture/`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ api_key: env.NEXT_PUBLIC_POSTHOG_KEY, event, distinct_id: distinctId, properties }),
    });
  } catch (err) {
    console.error("[analytics] capture failed", err);
  }
}
