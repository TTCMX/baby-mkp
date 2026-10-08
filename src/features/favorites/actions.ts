"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { track } from "@/lib/analytics/server";
import { createClient } from "@/lib/supabase/server";

/** Saves or un-saves a listing for the signed-in user (RLS: own rows; only active/reserved listings can be saved). */
export async function setFavorite(listingId: string, saved: boolean): Promise<{ saved: boolean; error?: string }> {
  if (!z.uuid().safeParse(listingId).success) return { saved: !saved, error: "Producto inválido" };
  const user = await requireUser(`/listing/${listingId}`);
  const supabase = await createClient();

  if (saved) {
    const { error } = await supabase.from("favorites").insert({ user_id: user.id, listing_id: listingId });
    // 23505: already saved (double tap, another tab): that's the state we wanted.
    if (error && error.code !== "23505") {
      console.error("[favorites] save failed", error);
      return { saved: false, error: "No pudimos guardarlo" };
    }
    if (!error) await track("favorite_added", user.id, { listing_id: listingId });
  } else {
    const { error } = await supabase.from("favorites").delete().eq("user_id", user.id).eq("listing_id", listingId);
    if (error) return { saved: true, error: "No pudimos quitarlo" };
  }
  revalidatePath("/favorites");
  return { saved };
}
