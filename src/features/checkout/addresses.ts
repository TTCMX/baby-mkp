import "server-only";
import type { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { SavedAddress } from "./address-fields";
import type { addressSchema } from "./schema";

/** The user's default address (checkout and the seller's shipping origin start from it). */
export async function getDefaultAddress(userId: string): Promise<SavedAddress> {
  const supabase = await createClient();
  const { data: a } = await supabase
    .from("addresses")
    .select("*")
    .eq("user_id", userId)
    .eq("is_default", true)
    .maybeSingle();
  if (!a) return {};
  return {
    recipientName: a.recipient_name,
    phone: a.phone ?? "",
    street: a.street,
    exteriorNumber: a.exterior_number ?? "",
    interiorNumber: a.interior_number ?? "",
    neighborhood: a.neighborhood ?? "",
    municipality: a.municipality,
    city: a.city,
    state: a.state,
    postalCode: a.postal_code,
    references: a.references_note ?? "",
  };
}

/** Saves (or replaces) the user's default address. */
export async function saveDefaultAddress(userId: string, a: z.infer<typeof addressSchema>) {
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
