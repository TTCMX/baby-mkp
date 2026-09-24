"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { track } from "@/lib/analytics/server";
import { LISTING_IMAGES_BUCKET, listingFolder, thumbPath } from "@/lib/storage";
import type { ListingStatus } from "@/lib/domain/constants";
import { listingInputSchema, type ListingInput } from "./schema";

export type SaveListingResult =
  | { ok: true; id: string; status: ListingStatus }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

const RPC_ERRORS: Record<string, string> = {
  missing_images: "Agrega al menos una foto",
  too_many_images: "Tienes demasiadas fotos",
  missing_age_stage: "Elige al menos una edad o etapa",
  shipping_not_allowed: "Esta categoría no permite envío. Elige entrega local o recoger.",
  invalid_status: "Este producto ya no se puede publicar",
};

function friendly(message: string | undefined, fallback: string) {
  const key = Object.keys(RPC_ERRORS).find((k) => message?.includes(k));
  return key ? RPC_ERRORS[key] : fallback;
}

function revalidateListing(id: string) {
  revalidatePath("/");
  revalidatePath("/sell");
  revalidatePath(`/listing/${id}`);
}

/**
 * Creates or updates a listing (with its ordered photos) and optionally publishes it.
 * Photos are uploaded by the browser straight to Storage beforehand, under
 * `{userId}/{listingId}/`; here we only accept paths inside that folder.
 */
export async function saveListing(raw: ListingInput, intent: "draft" | "publish"): Promise<SaveListingResult> {
  const user = await requireUser("/sell/new");

  const parsed = listingInputSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisa los datos", fieldErrors };
  }
  const input = parsed.data;

  const folder = listingFolder(user.id, input.id);
  if (input.images.some((img) => !img.storage_path.startsWith(folder) || img.storage_path.includes(".."))) {
    return { ok: false, error: "Fotos inválidas. Vuelve a subirlas." };
  }

  const supabase = await createClient();

  const { data: category } = await supabase
    .from("categories")
    .select("id, allows_shipping")
    .eq("id", input.categoryId)
    .eq("is_active", true)
    .maybeSingle();
  if (!category) return { ok: false, error: "Elige una categoría", fieldErrors: { categoryId: "Elige una categoría" } };
  if (!category.allows_shipping && input.deliveryMethods.includes("shipping")) {
    return {
      ok: false,
      error: RPC_ERRORS.shipping_not_allowed,
      fieldErrors: { deliveryMethods: RPC_ERRORS.shipping_not_allowed },
    };
  }

  let brandId: string | null = null;
  if (input.brand) {
    const { data: brand } = await supabase.from("brands").select("id").ilike("name", input.brand).maybeSingle();
    brandId = brand?.id ?? null;
  }

  const fields = {
    title: input.title,
    description: input.description,
    category_id: input.categoryId,
    brand: input.brand,
    brand_id: brandId,
    model: input.model,
    condition: input.condition,
    age_stages: input.ageStages,
    listing_type: input.isBundle ? "bundle" : "single",
    bundle_item_count: input.isBundle ? input.bundleItemCount : null,
    price_cents: input.priceCents,
    city: input.city,
    municipality: input.municipality,
    delivery_methods: input.deliveryMethods,
    shipping_price_cents: input.deliveryMethods.includes("shipping") ? input.shippingPriceCents : null,
  };

  const { data: existing } = await supabase
    .from("listings")
    .select("id, status, listing_images(storage_path)")
    .eq("id", input.id)
    .eq("seller_id", user.id)
    .maybeSingle<{ id: string; status: ListingStatus; listing_images: { storage_path: string }[] }>();

  if (existing) {
    if (existing.status === "reserved" || existing.status === "sold") {
      return { ok: false, error: "Este producto ya está vendido o reservado y no se puede editar." };
    }
    const { error } = await supabase.from("listings").update(fields).eq("id", input.id);
    if (error) return { ok: false, error: "No pudimos guardar tu producto. Intenta de nuevo." };
  } else {
    const { error } = await supabase.from("listings").insert({ id: input.id, seller_id: user.id, ...fields });
    if (error) {
      console.error("[listings] insert failed", error);
      return { ok: false, error: "No pudimos guardar tu producto. Intenta de nuevo." };
    }
    await track("listing_created", user.id, { listing_id: input.id });
  }

  const { error: imagesError } = await supabase.rpc("replace_listing_images", {
    p_listing_id: input.id,
    p_images: input.images,
  });
  if (imagesError) return { ok: false, error: friendly(imagesError.message, "No pudimos guardar tus fotos.") };

  // Remove photos the seller took out (both sizes).
  const kept = new Set(input.images.map((i) => i.storage_path));
  const removed = (existing?.listing_images ?? []).map((i) => i.storage_path).filter((p) => !kept.has(p));
  if (removed.length) {
    await supabase.storage.from(LISTING_IMAGES_BUCKET).remove(removed.flatMap((p) => [p, thumbPath(p)]));
  }

  let status: ListingStatus = existing?.status ?? "draft";
  if (intent === "publish" && ["draft", "inactive", "rejected"].includes(status)) {
    const { data, error } = await supabase.rpc("publish_listing", { p_listing_id: input.id });
    if (error) return { ok: false, error: friendly(error.message, "No pudimos publicar tu producto.") };
    status = data as ListingStatus;
    await track("listing_published", user.id, { listing_id: input.id, status });
  }

  revalidateListing(input.id);
  return { ok: true, id: input.id, status };
}

const idSchema = z.uuid();

export async function publishListing(id: string): Promise<{ error?: string }> {
  const user = await requireUser("/sell");
  if (!idSchema.safeParse(id).success) return { error: "Producto inválido" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("publish_listing", { p_listing_id: id });
  if (error) return { error: friendly(error.message, "No pudimos publicar tu producto.") };
  await track("listing_published", user.id, { listing_id: id, status: data as string });
  revalidateListing(id);
  return {};
}

export async function unpublishListing(id: string): Promise<{ error?: string }> {
  await requireUser("/sell");
  if (!idSchema.safeParse(id).success) return { error: "Producto inválido" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("unpublish_listing", { p_listing_id: id });
  if (error) return { error: "No pudimos pausar tu producto." };
  revalidateListing(id);
  return {};
}

export async function deleteListing(id: string): Promise<{ error?: string }> {
  const user = await requireUser("/sell");
  if (!idSchema.safeParse(id).success) return { error: "Producto inválido" };
  const supabase = await createClient();

  const { data: images } = await supabase.from("listing_images").select("storage_path").eq("listing_id", id);
  const { error, count } = await supabase
    .from("listings")
    .delete({ count: "exact" })
    .eq("id", id)
    .eq("seller_id", user.id);
  if (error || !count) return { error: "Solo puedes borrar borradores o productos pausados." };

  const paths = (images ?? []).map((i) => i.storage_path as string);
  if (paths.length) await supabase.storage.from(LISTING_IMAGES_BUCKET).remove(paths.flatMap((p) => [p, thumbPath(p)]));
  revalidateListing(id);
  return {};
}
