import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";

/**
 * Service-role client: BYPASSES Row Level Security.
 * Only for trusted server code (Stripe webhooks, admin actions after an
 * explicit `requireAdmin()` check). Never import from client components.
 */
export function createAdminClient() {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error("SUPABASE_SECRET_KEY is not configured");

  return createClient(publicEnv().NEXT_PUBLIC_SUPABASE_URL, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
