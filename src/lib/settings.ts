import "server-only";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const settingsSchema = z.object({
  platform_commission_percentage: z.number().min(0).max(100),
  concierge_commission_percentage: z.number().min(0).max(100),
  concierge_min_price_cents: z.number().int().nonnegative(),
  listings_require_review: z.boolean(),
  max_images_per_listing: z.number().int().min(1).max(20),
  default_currency: z.string().length(3),
  order_auto_complete_days: z.number().int().min(1).max(60).default(3),
});

export type PlatformSettings = z.infer<typeof settingsSchema>;

/** Admin-editable platform configuration (commission, concierge threshold, ...). */
export async function getPlatformSettings(): Promise<PlatformSettings> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("platform_settings").select("key, value");
  if (error) throw error;
  return settingsSchema.parse(Object.fromEntries((data ?? []).map((r) => [r.key, r.value])));
}
