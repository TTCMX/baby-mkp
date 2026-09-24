"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { track } from "@/lib/analytics/server";
import { createClient } from "@/lib/supabase/server";
import { daysBetween, todayInMexico } from "./stages";

export type BabyFormState = { error?: string; ok?: boolean } | undefined;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Elige una fecha");

const babySchema = z
  .object({
    id: z.uuid().optional().or(z.literal("")),
    name: z.string().trim().min(1, "Escribe su nombre o apodo").max(40),
    kind: z.enum(["born", "expecting"]),
    date: isoDate,
    color: z.enum(["sky", "pink", "sun"]).default("sky"),
  })
  .superRefine((v, ctx) => {
    const diff = daysBetween(todayInMexico(), v.date);
    if (v.kind === "born" && diff > 0)
      ctx.addIssue({ code: "custom", path: ["date"], message: "La fecha de nacimiento no puede ser futura" });
    if (v.kind === "born" && diff < -365 * 18)
      ctx.addIssue({ code: "custom", path: ["date"], message: "Revisa la fecha de nacimiento" });
    if (v.kind === "expecting" && (diff < -30 || diff > 300)) {
      ctx.addIssue({
        code: "custom",
        path: ["date"],
        message: "La fecha probable de parto debe estar en los próximos 10 meses",
      });
    }
  });

export async function saveBaby(_prev: BabyFormState, formData: FormData): Promise<BabyFormState> {
  const user = await requireUser("/babies");
  const parsed = babySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const { id, name, kind, date, color } = parsed.data;
  const row = {
    name,
    color,
    birth_date: kind === "born" ? date : null,
    due_date: kind === "expecting" ? date : null,
  };

  // RLS: parents only touch their own babies.
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("babies").update(row).eq("id", id)
    : await supabase.from("babies").insert({ ...row, user_id: user.id });
  if (error) {
    if (error.message.includes("too_many_babies")) return { error: "Puedes registrar hasta 8 bebés" };
    console.error("[babies] save failed", error);
    return { error: "No pudimos guardar. Intenta de nuevo." };
  }
  if (!id) await track("baby_added", user.id, { kind });
  revalidatePath("/");
  revalidatePath("/babies");
  return { ok: true };
}

export async function deleteBaby(id: string): Promise<{ error?: string }> {
  await requireUser("/babies");
  if (!z.uuid().safeParse(id).success) return { error: "Bebé inválido" };
  const supabase = await createClient();
  const { error } = await supabase.from("babies").delete().eq("id", id);
  if (error) return { error: "No pudimos borrar. Intenta de nuevo." };
  revalidatePath("/");
  revalidatePath("/babies");
  return {};
}
