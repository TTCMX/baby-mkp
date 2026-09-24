"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { processPayout, trackCompletion } from "@/features/payments/payouts";

export type OrderActionResult = { error?: string };

const id = z.uuid();
const ERRORS: Record<string, string> = {
  invalid_transition: "Este pedido ya cambió de estado. Recarga la página.",
  reason_too_short: "Cuéntanos un poco más (mínimo 10 caracteres).",
};

async function call(fn: string, args: Record<string, unknown>, orderId: string): Promise<OrderActionResult> {
  await requireUser(`/orders/${orderId}`);
  if (!id.safeParse(orderId).success) return { error: "Pedido inválido" };
  const supabase = await createClient();
  // The RPC checks that the caller is the right party for this step.
  const { error } = await supabase.rpc(fn, args);
  if (error) {
    const key = Object.keys(ERRORS).find((k) => error.message.includes(k));
    if (!key) console.error(`[orders] ${fn} failed`, error);
    return { error: key ? ERRORS[key] : "No pudimos actualizar el pedido. Intenta de nuevo." };
  }
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
  return {};
}

const shippedSchema = z.object({
  carrier: z.string().trim().max(60).optional().default(""),
  tracking: z.string().trim().max(80).optional().default(""),
});

export async function markShipped(orderId: string, input: { carrier?: string; tracking?: string }) {
  const parsed = shippedSchema.safeParse(input);
  if (!parsed.success) return { error: "Revisa los datos de la guía" };
  return call(
    "order_mark_shipped",
    { p_order_id: orderId, p_carrier: parsed.data.carrier, p_tracking: parsed.data.tracking },
    orderId,
  );
}

export async function markDelivered(orderId: string) {
  return call("order_mark_delivered", { p_order_id: orderId }, orderId);
}

export async function confirmReceived(orderId: string) {
  const result = await call("order_confirm_received", { p_order_id: orderId }, orderId);
  if (!result.error) {
    await trackCompletion(orderId);
    await processPayout(orderId);
  }
  return result;
}

export async function reportProblem(orderId: string, reason: string) {
  return call("order_report_problem", { p_order_id: orderId, p_reason: String(reason ?? "").slice(0, 1000) }, orderId);
}

const reviewSchema = z.object({
  rating: z.number().int().min(1, "Elige de 1 a 5 estrellas").max(5),
  comment: z.string().trim().max(1000).optional().default(""),
});

export async function submitReview(
  orderId: string,
  input: { rating: number; comment?: string },
): Promise<OrderActionResult> {
  const user = await requireUser(`/orders/${orderId}`);
  if (!id.safeParse(orderId).success) return { error: "Pedido inválido" };
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const { data: order } = await supabase.from("orders").select("buyer_id, seller_id").eq("id", orderId).maybeSingle();
  if (!order) return { error: "Pedido no encontrado" };
  const revieweeId = order.buyer_id === user.id ? order.seller_id : order.buyer_id;

  // RLS only allows participants of a completed order, once each.
  const { error } = await supabase.from("reviews").insert({
    order_id: orderId,
    reviewer_id: user.id,
    reviewee_id: revieweeId,
    rating: parsed.data.rating,
    comment: parsed.data.comment || null,
  });
  if (error) {
    return { error: error.code === "23505" ? "Ya dejaste tu reseña." : "No pudimos guardar tu reseña." };
  }
  revalidatePath(`/orders/${orderId}`);
  return {};
}
