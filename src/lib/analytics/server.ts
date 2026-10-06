import "server-only";
import { after } from "next/server";
import { publicEnv } from "@/lib/env";
import type { AnalyticsEvent, AnalyticsProperties } from "./events";

/**
 * Server-side event capture through PostHog's HTTP API (no SDK needed).
 * Business events (orders, payments, payouts) are tracked server-side so
 * they cannot be blocked or spoofed by the browser. Never throws.
 *
 * The request is sent with `after()`, once the response is on its way, so
 * analytics never slows down a page or an action.
 */
export async function track(event: AnalyticsEvent, distinctId: string, properties: AnalyticsProperties = {}) {
  const env = publicEnv();
  const key = env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) {
    if (process.env.NODE_ENV === "development") console.info("[analytics]", event, distinctId, properties);
    return;
  }
  const send = () => capture(env.NEXT_PUBLIC_POSTHOG_HOST, key, event, distinctId, properties);
  try {
    after(send);
  } catch {
    // Outside a request (scripts, tests): send inline.
    await send();
  }
}

async function capture(
  host: string,
  key: string,
  event: AnalyticsEvent,
  distinctId: string,
  properties: AnalyticsProperties,
) {
  try {
    await fetch(`${host}/capture/`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ api_key: key, event, distinct_id: distinctId, properties }),
    });
  } catch (err) {
    console.error("[analytics] capture failed", err);
  }
}
