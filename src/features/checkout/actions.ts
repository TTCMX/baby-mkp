"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { track } from "@/lib/analytics/server";
import { publicEnv } from "@/lib/env";
import { computeOrderAmounts } from "@/lib/pricing";
import { getPlatformSettings } from "@/lib/settings";
import { listingPhotoUrl } from "@/lib/storage";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { addressSchema, CHECKOUT_ERRORS, checkoutSchema } from "./schema";

export type CheckoutState = { error?: string; fieldErrors?: Record<string, string> } | undefined;

const CHECKOUT_TTL_SECONDS = 30 * 60; // Stripe's minimum session lifetime

export async function startCheckout(_prev: CheckoutState, formData: FormData): Promise<CheckoutState> {
  const raw = Object.fromEntries(formData);
  const user = await requireUser(`/checkout/${String(raw.listingId ?? "")}`);

  const parsed = checkoutSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const { listingId, deliveryMethod } = parsed.data;

  let address: z.infer<typeof addressSchema> | null = null;
  if (deliveryMethod !== "pickup") {
    const a = addressSchema.safeParse(raw);
    if (!a.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of a.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
      return { error: "Revisa tu dirección", fieldErrors };
    }
    address = a.data;
  }

  // Read the listing as the buyer (RLS): only active, visible listings.
  const supabase = await createClient();
  const { data: listing } = await supabase
    .from("listings")
    .select(
      "id, title, price_cents, shipping_price_cents, status, sale_channel, listing_images(storage_path, position)",
    )
    .eq("id", listingId)
    .maybeSingle();
  if (!listing || listing.status !== "active") return { error: CHECKOUT_ERRORS.listing_unavailable };

  const settings = await getPlatformSettings();
  const commission =
    listing.sale_channel === "concierge"
      ? settings.concierge_commission_percentage
      : settings.platform_commission_percentage;
  const amounts = computeOrderAmounts({
    itemPriceCents: listing.price_cents,
    shippingCents: deliveryMethod === "shipping" ? (listing.shipping_price_cents ?? 0) : 0,
    commissionPercentage: commission,
  });

  const admin = createAdminClient();
  const { data: orderId, error: orderError } = await admin.rpc("create_checkout_order", {
    p_listing_id: listingId,
    p_buyer_id: user.id,
    p_delivery_method: deliveryMethod,
    p_shipping_address: address,
    p_item_price_cents: amounts.itemPriceCents,
    p_shipping_cents: amounts.shippingCents,
    p_commission_percentage: amounts.commissionPercentage,
    p_platform_commission_cents: amounts.platformCommissionCents,
    p_seller_net_cents: amounts.sellerNetCents,
  });
  if (orderError || !orderId) {
    const key = Object.keys(CHECKOUT_ERRORS).find((k) => orderError?.message.includes(k));
    if (!key) console.error("[checkout] create order failed", orderError);
    return { error: key ? CHECKOUT_ERRORS[key] : "No pudimos iniciar tu compra. Intenta de nuevo." };
  }

  // Remember the address for next time (buyer's own row, RLS applies).
  if (address) await saveDefaultAddress(user.id, address);

  const site = publicEnv().NEXT_PUBLIC_SITE_URL;
  const cover = [...(listing.listing_images ?? [])].sort((a, b) => a.position - b.position)[0];
  let sessionUrl: string;
  try {
    const session = await getStripe().checkout.sessions.create(
      {
        mode: "payment",
        currency: "mxn",
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "mxn",
              unit_amount: amounts.itemPriceCents,
              product_data: {
                name: listing.title,
                ...(cover && { images: [listingPhotoUrl(cover.storage_path)] }),
              },
            },
          },
          ...(amounts.shippingCents > 0
            ? [
                {
                  quantity: 1,
                  price_data: {
                    currency: "mxn",
                    unit_amount: amounts.shippingCents,
                    product_data: { name: "Envío" },
                  },
                },
              ]
            : []),
        ],
        customer_email: user.email ?? undefined,
        client_reference_id: orderId,
        metadata: { order_id: orderId, listing_id: listingId },
        // Funds stay on the platform; the seller's transfer is created when the order completes.
        payment_intent_data: { transfer_group: orderId, metadata: { order_id: orderId, listing_id: listingId } },
        expires_at: Math.floor(Date.now() / 1000) + CHECKOUT_TTL_SECONDS,
        success_url: `${site}/orders/${orderId}?paid=1`,
        cancel_url: `${site}/checkout/${listingId}?cancelled=${orderId}`,
        locale: "es-419",
      },
      { idempotencyKey: `checkout-${orderId}` },
    );
    if (!session.url) throw new Error("Stripe session without URL");
    await admin.from("orders").update({ stripe_checkout_session_id: session.id }).eq("id", orderId);
    sessionUrl = session.url;
  } catch (err) {
    console.error("[checkout] stripe session failed", err);
    await admin.rpc("cancel_pending_order", { p_order_id: orderId, p_reason: "checkout_error" });
    return { error: "No pudimos conectar con el procesador de pagos. Intenta de nuevo." };
  }

  await track("checkout_started", user.id, {
    listing_id: listingId,
    order_id: orderId,
    total_cents: amounts.totalCents,
    delivery: deliveryMethod,
  });
  redirect(sessionUrl);
}

async function saveDefaultAddress(userId: string, a: z.infer<typeof addressSchema>) {
  const supabase = await createClient();
  const row = {
    user_id: userId,
    recipient_name: a.recipientName,
    phone: a.phone,
    street: a.street,
    exterior_number: a.exteriorNumber,
    interior_number: a.interiorNumber || null,
    neighborhood: a.neighborhood,
    municipality: a.municipality,
    city: a.city,
    state: a.state,
    postal_code: a.postalCode,
    references_note: a.references || null,
    is_default: true,
  };
  const { data: existing } = await supabase
    .from("addresses")
    .select("id")
    .eq("user_id", userId)
    .eq("is_default", true)
    .maybeSingle();
  const { error } = existing
    ? await supabase.from("addresses").update(row).eq("id", existing.id)
    : await supabase.from("addresses").insert(row);
  // Not fatal for the purchase (the address is snapshotted on the order).
  if (error) console.error("[checkout] could not save address", error);
}
