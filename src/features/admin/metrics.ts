import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type Metrics = {
  orders: number;
  gmv_cents: number;
  revenue_cents: number;
  net_revenue_cents: number;
  avg_ticket_cents: number;
  take_rate: number;
  completed_orders: number;
  open_disputes: number;
  pending_payouts: number;
  active_listings: number;
  sold_listings: number;
  pending_review: number;
  sell_through: number;
  avg_days_to_sale: number;
  new_users: number;
};

/** All-time and last-N-days marketplace KPIs (service role; callers must be admins). */
export async function getMetrics(days = 30): Promise<{ all: Metrics; recent: Metrics }> {
  const db = createAdminClient();
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const [all, recent] = await Promise.all([db.rpc("admin_metrics"), db.rpc("admin_metrics", { p_since: since })]);
  if (all.error || recent.error) throw all.error ?? recent.error;
  return { all: all.data as Metrics, recent: recent.data as Metrics };
}
