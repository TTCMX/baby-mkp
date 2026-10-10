"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { track } from "@/lib/analytics/server";
import { parsePriceToCents } from "@/lib/money";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { cleanClabe, isValidClabe } from "@/features/wallet/clabe";
import type { AdminResult } from "./actions";
import { logAdminAction } from "./audit";
import { emailNotificationsSoon } from "@/features/notifications/emails";

// Admins operate the managed sellers (profiles of people who never sign in).

const uuid = z.uuid();

async function managedSeller(id: string) {
  if (!uuid.safeParse(id).success) return null;
  const { data } = await createAdminClient().from("profiles").select("id, is_managed").eq("id", id).maybeSingle();
  return data?.is_managed ? data : null;
}

export async function saveManagedBankAccount(userId: string, formData: FormData): Promise<AdminResult> {
  const admin = await requireAdmin();
  if (!(await managedSeller(userId))) return { error: "Vendedor gestionado no encontrado" };
  const clabe = cleanClabe(String(formData.get("clabe") ?? ""));
  const holderName = String(formData.get("holderName") ?? "").trim();
  const bankName = String(formData.get("bankName") ?? "").trim();
  if (!isValidClabe(clabe)) return { error: "CLABE inválida (18 dígitos, revisa el último)" };
  if (holderName.length < 3 || bankName.length < 2) return { error: "Escribe titular y banco" };

  const { error } = await createAdminClient()
    .from("bank_accounts")
    .upsert({ user_id: userId, clabe, holder_name: holderName.slice(0, 120), bank_name: bankName.slice(0, 80) });
  if (error) return { error: "No pudimos guardar la cuenta" };
  await logAdminAction(admin.id, "managed.bank_account", "user", userId, { clabe_last4: clabe.slice(-4) });
  revalidatePath("/admin/managed");
  return { ok: "Cuenta guardada" };
}

/** Withdraws (part of) a managed seller's balance to their CLABE, paid on the next payout Tuesday. */
export async function withdrawForManaged(userId: string, amount: string): Promise<AdminResult> {
  const admin = await requireAdmin();
  if (!(await managedSeller(userId))) return { error: "Vendedor gestionado no encontrado" };
  const cents = parsePriceToCents(amount);
  if (!cents || cents <= 0) return { error: "Escribe un monto válido" };

  const { data, error } = await createAdminClient()
    .rpc("withdraw_for", { p_user: userId, p_amount_cents: cents })
    .single<{ id: string; payout_date: string }>();
  if (error || !data) {
    if (error?.message.includes("insufficient_balance")) return { error: "No tiene saldo suficiente" };
    if (error?.message.includes("bank_account_required")) return { error: "Primero guarda su CLABE" };
    if (error?.message.includes("amount_too_small")) return { error: "Monto menor al mínimo" };
    console.error("[admin] managed withdrawal failed", error);
    return { error: "No pudimos registrar el retiro" };
  }
  await logAdminAction(admin.id, "managed.withdrawal", "user", userId, { amount_cents: cents, withdrawal_id: data.id });
  await track("withdrawal_requested", userId, { withdrawal_id: data.id, amount_cents: cents, managed: true });
  revalidatePath("/admin/managed");
  revalidatePath("/admin/withdrawals");
  return { ok: `Retiro programado para el ${data.payout_date}` };
}

const contactSchema = z.object({
  email: z.union([z.literal(""), z.email("Correo inválido")]),
  phone: z.string().trim().max(30),
});

/** What buyers of managed products see as the seller's contact (the warehouse). */
export async function saveManagedContact(_prev: AdminResult | undefined, formData: FormData): Promise<AdminResult> {
  const admin = await requireAdmin();
  const parsed = contactSchema.safeParse({
    email: String(formData.get("email") ?? "").trim(),
    phone: formData.get("phone"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const db = createAdminClient();
  for (const [key, value] of [
    ["managed_contact_email", parsed.data.email],
    ["managed_contact_phone", parsed.data.phone],
  ] as const) {
    const { error } = await db.from("platform_settings").update({ value, updated_by: admin.id }).eq("key", key);
    if (error) return { error: "No pudimos guardar el contacto" };
  }
  await logAdminAction(admin.id, "settings.update", "setting", "managed_contact", parsed.data);
  revalidatePath("/admin/managed");
  return { ok: "Contacto guardado" };
}

// Delivery steps of a managed seller's order: the same RPCs sellers use; the
// database lets admins act only for managed sellers (`can_act_for_seller`).
async function orderStep(fn: "order_mark_shipped" | "order_mark_delivered", orderId: string, args: object) {
  const admin = await requireAdmin();
  if (!uuid.safeParse(orderId).success) return { error: "Pedido inválido" };
  const supabase = await createClient();
  const { error } = await supabase.rpc(fn, { p_order_id: orderId, ...args });
  if (error) {
    if (error.message.includes("invalid_transition")) return { error: "El pedido ya cambió de estado" };
    if (error.message.includes("label_required")) return { error: "Primero adjunta la guía de envío (abajo)" };
    console.error(`[admin] ${fn} failed`, error);
    return { error: "No pudimos actualizar el pedido" };
  }
  await logAdminAction(
    admin.id,
    fn === "order_mark_shipped" ? "order.ship" : "order.deliver",
    "order",
    orderId,
    args as Record<string, unknown>,
  );
  emailNotificationsSoon();
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
  return { ok: fn === "order_mark_shipped" ? "Marcado como enviado" : "Marcado como entregado" };
}

/** "DHL 123456" → carrier + tracking (both optional). */
export async function shipManagedOrder(orderId: string, tracking: string): Promise<AdminResult> {
  const [carrier = "", ...rest] = tracking.trim().split(/\s+/);
  return orderStep("order_mark_shipped", orderId, {
    p_carrier: carrier.slice(0, 60),
    p_tracking: rest.join(" ").slice(0, 80),
  });
}

export async function deliverManagedOrder(orderId: string): Promise<AdminResult> {
  return orderStep("order_mark_delivered", orderId, {});
}
