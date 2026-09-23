"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type ProfileFormState = { error?: string; ok?: boolean } | undefined;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v));

const profileSchema = z.object({
  displayName: z.string().trim().min(1, "Escribe tu nombre").max(60),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]{3,30}$/, "Usuario: 3–30 caracteres, solo letras, números y _"),
  city: optionalText(80),
  municipality: optionalText(80),
  bio: optionalText(500),
  phone: z
    .string()
    .trim()
    .regex(/^[+\d\s()-]{0,20}$/, "Teléfono inválido")
    .transform((v) => (v === "" ? null : v)),
});

export async function updateProfile(_prev: ProfileFormState, formData: FormData): Promise<ProfileFormState> {
  const user = await requireUser("/settings");
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const { displayName, username, city, municipality, bio, phone } = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase
    .from("profiles")
    .update({ display_name: displayName, username, city, municipality, bio })
    .eq("id", user.id);
  if (error) {
    return { error: error.code === "23505" ? "Ese usuario ya está ocupado" : "No pudimos guardar tus cambios" };
  }

  const { error: privateError } = await supabase.from("private_profiles").update({ phone }).eq("id", user.id);
  if (privateError) return { error: "No pudimos guardar tu teléfono" };

  revalidatePath("/settings");
  revalidatePath(`/profile/${username}`);
  return { ok: true };
}
