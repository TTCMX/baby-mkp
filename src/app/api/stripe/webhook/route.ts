import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { handleStripeEvent } from "@/features/checkout/webhook";

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!secret || !signature) return NextResponse.json({ error: "not_configured" }, { status: 400 });

  // The signature is computed over the raw body: read it as text, untouched.
  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, secret);
  } catch {
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  try {
    await handleStripeEvent(event);
  } catch (err) {
    console.error("[webhook] handler failed", event.type, event.id, err);
    // 500 → Stripe retries with backoff.
    return NextResponse.json({ error: "handler_failed" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
