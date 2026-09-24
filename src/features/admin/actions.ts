"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { LISTING_CONDITIONS, keysOf } from "@/lib/domain/constants";
import { parsePriceToCents } from "@/lib/money";
import { createAdminClient } from "@/lib/supabase/admin";
import { processPayout, trackCompletion } from "@/features/payments/payouts";
import { logAdminAction } from "./audit";
import { refundOrder as refund } from "./refunds";

// Every action: requireAdmin() first (the layout check alone does not protect
// Server Actions), then a service-role write, then an audit log entry.

export type AdminResult = { error?: string; ok?: string };

const uuid = z.uuid();
const text = (min: number, max: number, msg: string) => z.string().trim().min(min, msg).max(max);

function fail(err: unknown, fallback: string): AdminResult {
  console.error("[admin]", err);
  return { error: fallback };
}

// ------------------------------------------------------------------ listings

type ListingMove = "approve" | "reject" | "deactivate" | "reactivate" | "mark_sold";

const LISTING_MOVES: Record<ListingMove, { from: string[]; to: string }> = {
  approve: { from: ["pending_review"], to: "active" },
  reject: { from: ["pending_review", "active", "inactive"], to: "rejected" },
  deactivate: { from: ["active", "pending_review"], to: "inactive" },
  reactivate: { from: ["inactive", "rejected"], to: "active" },
  // Not "reserved": a buyer may be paying right now.
  mark_sold: { from: ["active", "inactive"], to: "sold" },
};

const SELLER_NOTICE: Partial<Record<ListingMove, { title: string; body: (reason?: string) => string }>> = {
  approve: { title: "Tu producto ya está publicado", body: () => "Lo revisamos y ya aparece en el catálogo." },
  reject: { title: "No pudimos publicar tu producto", body: (r) => r ?? "Revisa los detalles y vuelve a intentarlo." },
  deactivate: { title: "Pausamos tu producto", body: (r) => r ?? "Escríbenos si tienes dudas." },
};

export async function moveListing(listingId: string, move: ListingMove, reason?: string): Promise<AdminResult> {
  const admin = await requireAdmin();
  if (!uuid.safeParse(listingId).success || !(move in LISTING_MOVES)) return { error: "Acción inválida" };
  const cleanReason = reason?.trim().slice(0, 500) || undefined;
  if (move === "reject" && !cleanReason) return { error: "Escribe el motivo del rechazo" };

  const { from, to } = LISTING_MOVES[move];
  const db = createAdminClient();
  const now = new Date().toISOString();
  const { data: listing, error } = await db
    .from("listings")
    .update({
      status: to,
      ...(to === "active" && { rejection_reason: null }),
      ...(move === "reject" && { rejection_reason: cleanReason }),
      ...(move === "mark_sold" && { sold_at: now }),
    })
    .eq("id", listingId)
    .in("status", from)
    .select("id, seller_id, published_at")
    .maybeSingle();
  if (error) return fail(error, "No pudimos actualizar el producto");
  if (!listing) return { error: "El producto cambió de estado. Recarga la página." };
  if (to === "active" && !listing.published_at) {
    await db.from("listings").update({ published_at: now }).eq("id", listingId);
  }

  const notice = SELLER_NOTICE[move];
  if (notice) {
    await db.from("notifications").insert({
      user_id: listing.seller_id,
      type: `listing_${move}`,
      title: notice.title,
      body: notice.body(cleanReason),
      link: move === "approve" ? `/listing/${listingId}` : "/sell",
      data: { listing_id: listingId },
    });
  }
  await logAdminAction(admin.id, `listing.${move}`, "listing", listingId, { reason: cleanReason });
  revalidatePath("/admin/listings");
  revalidatePath(`/listing/${listingId}`);
  revalidatePath("/");
  return { ok: "Listo" };
}

const listingEditSchema = z.object({
  title: text(3, 90, "Título de 3 a 90 caracteres"),
  description: z.string().trim().max(4000),
  price: z.string().transform((v, ctx) => {
    const cents = parsePriceToCents(v);
    if (!cents || cents < 1000) {
      ctx.addIssue({ code: "custom", message: "Precio inválido (mínimo $10)" });
      return z.NEVER;
    }
    return cents;
  }),
  categoryId: z.uuid(),
  condition: z.enum(keysOf(LISTING_CONDITIONS) as [string, ...string[]]),
});

export async function updateListingAsAdmin(listingId: string, formData: FormData): Promise<AdminResult> {
  const admin = await requireAdmin();
  if (!uuid.safeParse(listingId).success) return { error: "Producto inválido" };
  const parsed = listingEditSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const d = parsed.data;

  const db = createAdminClient();
  const { data: before } = await db
    .from("listings")
    .select("title, price_cents, category_id, condition")
    .eq("id", listingId)
    .maybeSingle();
  if (!before) return { error: "Producto no encontrado" };
  const { error } = await db
    .from("listings")
    .update({
      title: d.title,
      description: d.description,
      price_cents: d.price,
      category_id: d.categoryId,
      condition: d.condition,
    })
    .eq("id", listingId);
  if (error) return fail(error, "No pudimos guardar los cambios");

  await logAdminAction(admin.id, "listing.edit", "listing", listingId, { before, after: d });
  revalidatePath(`/admin/listings/${listingId}`);
  revalidatePath(`/listing/${listingId}`);
  return { ok: "Cambios guardados" };
}

// --------------------------------------------------------------------- users

export async function setUserStatus(
  userId: string,
  status: "active" | "suspended",
  reason?: string,
): Promise<AdminResult> {
  const admin = await requireAdmin();
  if (!uuid.safeParse(userId).success) return { error: "Usuario inválido" };
  if (userId === admin.id) return { error: "No puedes suspender tu propia cuenta" };

  const db = createAdminClient();
  const { data: target } = await db.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (!target) return { error: "Usuario no encontrado" };
  if (target.role === "admin") return { error: "No puedes suspender a otro administrador" };

  const { error } = await db.from("profiles").update({ status }).eq("id", userId);
  if (error) return fail(error, "No pudimos actualizar la cuenta");

  let paused = 0;
  if (status === "suspended") {
    // A suspended user's products leave the catalogue.
    const { data } = await db
      .from("listings")
      .update({ status: "inactive" })
      .eq("seller_id", userId)
      .in("status", ["active", "pending_review"])
      .select("id");
    paused = data?.length ?? 0;
  }
  await logAdminAction(admin.id, `user.${status === "suspended" ? "suspend" : "reactivate"}`, "user", userId, {
    reason: reason?.slice(0, 500),
    listings_paused: paused,
  });
  revalidatePath("/admin/users");
  return { ok: status === "suspended" ? `Cuenta suspendida (${paused} productos pausados)` : "Cuenta reactivada" };
}

// -------------------------------------------------------------------- orders

export async function refundOrderAsAdmin(orderId: string, reason: string): Promise<AdminResult> {
  const admin = await requireAdmin();
  if (!uuid.safeParse(orderId).success) return { error: "Pedido inválido" };
  const cleanReason = reason?.trim().slice(0, 500);
  if (!cleanReason || cleanReason.length < 5) return { error: "Escribe el motivo del reembolso" };
  try {
    await refund(orderId, cleanReason, `Resuelto a favor del comprador: ${cleanReason}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "not_refundable") return { error: "Este pedido no se puede reembolsar en su estado actual" };
    return fail(err, "No pudimos completar el reembolso. Revisa Stripe antes de reintentar.");
  }
  await logAdminAction(admin.id, "order.refund", "order", orderId, { reason: cleanReason });
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
  return { ok: "Reembolso realizado" };
}

/** Dispute resolved for the seller (or a stuck order): complete it and release the payout. */
export async function completeOrderAsAdmin(orderId: string, note: string): Promise<AdminResult> {
  const admin = await requireAdmin();
  if (!uuid.safeParse(orderId).success) return { error: "Pedido inválido" };
  const cleanNote = note?.trim().slice(0, 500);
  if (!cleanNote || cleanNote.length < 5) return { error: "Escribe una nota sobre la resolución" };

  const db = createAdminClient();
  const now = new Date().toISOString();
  const { data: order, error } = await db
    .from("orders")
    .select("id, status, disputed_at, dispute_resolved_at, buyer_id, seller_id")
    .eq("id", orderId)
    .maybeSingle();
  if (error || !order) return { error: "Pedido no encontrado" };
  if (!["paid", "in_delivery", "delivered"].includes(order.status))
    return { error: "Este pedido no se puede completar" };

  const { error: updateError } = await db
    .from("orders")
    .update({
      status: "completed",
      completed_at: now,
      delivered_at: now,
      ...(order.disputed_at &&
        !order.dispute_resolved_at && {
          dispute_resolved_at: now,
          dispute_resolution: `A favor del vendedor: ${cleanNote}`,
        }),
    })
    .eq("id", orderId)
    .in("status", ["paid", "in_delivery", "delivered"]);
  if (updateError) return fail(updateError, "No pudimos completar el pedido");

  await db.from("notifications").insert(
    [order.buyer_id, order.seller_id].map((user_id) => ({
      user_id,
      type: "order_completed_by_admin",
      title: "Pedido completado",
      body: cleanNote,
      link: `/orders/${orderId}`,
      data: { order_id: orderId },
    })),
  );
  await trackCompletion(orderId);
  const payout = await processPayout(orderId);
  await logAdminAction(admin.id, "order.complete", "order", orderId, { note: cleanNote, payout });
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
  return {
    ok:
      payout === "paid"
        ? "Pedido completado y pago liberado"
        : "Pedido completado (pago pendiente de la cuenta del vendedor)",
  };
}

// ------------------------------------------------------------------ settings

const settingsSchema = z.object({
  platform_commission_percentage: z.coerce.number().min(0).max(50),
  concierge_commission_percentage: z.coerce.number().min(0).max(80),
  concierge_min_price: z.coerce.number().int().min(0).max(1_000_000),
  max_images_per_listing: z.coerce.number().int().min(1).max(20),
  order_auto_complete_days: z.coerce.number().int().min(1).max(60),
  listings_require_review: z.enum(["on", "off"]).optional(),
});

export async function updatePlatformSettings(_prev: AdminResult | undefined, formData: FormData): Promise<AdminResult> {
  const admin = await requireAdmin();
  const parsed = settingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { error: `Revisa ${String(parsed.error.issues[0]?.path[0])}: ${parsed.error.issues[0]?.message}` };
  const d = parsed.data;
  const values: Record<string, unknown> = {
    platform_commission_percentage: d.platform_commission_percentage,
    concierge_commission_percentage: d.concierge_commission_percentage,
    concierge_min_price_cents: d.concierge_min_price * 100,
    max_images_per_listing: d.max_images_per_listing,
    order_auto_complete_days: d.order_auto_complete_days,
    listings_require_review: d.listings_require_review === "on",
  };

  const db = createAdminClient();
  const { data: before } = await db.from("platform_settings").select("key, value");
  for (const [key, value] of Object.entries(values)) {
    const { error } = await db.from("platform_settings").update({ value, updated_by: admin.id }).eq("key", key);
    if (error) return fail(error, "No pudimos guardar la configuración");
  }
  await logAdminAction(admin.id, "settings.update", "setting", "platform", {
    before: Object.fromEntries((before ?? []).map((r) => [r.key, r.value])),
    after: values,
  });
  revalidatePath("/admin/settings");
  return { ok: "Configuración guardada. Aplica a las compras nuevas." };
}

const categorySchema = z.object({
  id: z.uuid().optional().or(z.literal("")),
  name: text(1, 60, "Escribe el nombre"),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]{2,60}$/, "Slug: minúsculas, números y guiones"),
  icon: z.string().trim().max(30).optional(),
  sort_order: z.coerce.number().int().min(0).max(10_000),
  allows_shipping: z.enum(["on"]).optional(),
  is_active: z.enum(["on"]).optional(),
});

export async function saveCategory(_prev: AdminResult | undefined, formData: FormData): Promise<AdminResult> {
  const admin = await requireAdmin();
  const parsed = categorySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const { id, allows_shipping, is_active, ...rest } = parsed.data;
  const row = {
    ...rest,
    icon: rest.icon || null,
    allows_shipping: allows_shipping === "on",
    is_active: is_active === "on",
  };

  const db = createAdminClient();
  const { data, error } = id
    ? await db.from("categories").update(row).eq("id", id).select("id").single()
    : await db.from("categories").insert(row).select("id").single();
  if (error)
    return error.code === "23505"
      ? { error: "Ya existe una categoría con ese slug" }
      : fail(error, "No pudimos guardar la categoría");

  await logAdminAction(admin.id, id ? "category.update" : "category.create", "category", data.id, row);
  revalidatePath("/admin/settings");
  revalidatePath("/");
  return { ok: id ? "Categoría actualizada" : "Categoría creada" };
}
