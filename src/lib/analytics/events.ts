// Analytics event catalogue. Adding an event = adding it here, so names stay
// consistent between client, server and PostHog dashboards.
export const ANALYTICS_EVENTS = [
  "user_registered",
  "listing_started",
  "listing_created",
  "listing_published",
  "listing_viewed",
  "search_performed",
  "filter_used",
  "favorite_added",
  "checkout_started",
  "payment_completed",
  "order_created",
  "order_completed",
  "listing_sold",
  "seller_payout",
  "concierge_requested",
  "concierge_accepted",
  "concierge_completed",
] as const;

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[number];
export type AnalyticsProperties = Record<string, string | number | boolean | null | undefined>;
