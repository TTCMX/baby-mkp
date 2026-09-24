import "server-only";
import Stripe from "stripe";

let client: Stripe | undefined;

/**
 * Server-side Stripe client. STRIPE_API_BASE is only for local testing
 * against stripe-mock (e.g. http://localhost:12111); never set it in production.
 */
export function getStripe(): Stripe {
  if (client) return client;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");

  const base = process.env.STRIPE_API_BASE ? new URL(process.env.STRIPE_API_BASE) : null;
  client = new Stripe(key, {
    appInfo: { name: "baby-mkp" },
    maxNetworkRetries: 2,
    ...(base && {
      host: base.hostname,
      port: Number(base.port) || (base.protocol === "https:" ? 443 : 80),
      protocol: base.protocol.replace(":", "") as "http" | "https",
    }),
  });
  return client;
}

export function isStripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}
