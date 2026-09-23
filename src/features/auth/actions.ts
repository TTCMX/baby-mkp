"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import { safeNextPath } from "@/lib/safe-redirect";
import { track } from "@/lib/analytics/server";

export type AuthFormState = { error?: string; message?: string; fields?: Record<string, string> } | undefined;

const credentials = z.object({
  email: z.email("Escribe un correo válido").trim().toLowerCase(),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres").max(72),
});

const signUpSchema = credentials.extend({
  displayName: z.string().trim().min(1, "¿Cómo te llamas?").max(60),
});

export async function signIn(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = credentials.safeParse(Object.fromEntries(formData));
  const email = String(formData.get("email") ?? "");
  if (!parsed.success) return { error: parsed.error.issues[0]?.message, fields: { email } };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    const msg =
      error.code === "email_not_confirmed"
        ? "Confirma tu correo antes de entrar. Revisa tu bandeja de entrada."
        : "Correo o contraseña incorrectos";
    return { error: msg, fields: { email } };
  }

  redirect(safeNextPath(formData.get("next")));
}

export async function signUp(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  const fields = { email: String(formData.get("email") ?? ""), displayName: String(formData.get("displayName") ?? "") };
  if (!parsed.success) return { error: parsed.error.issues[0]?.message, fields };

  const next = safeNextPath(formData.get("next"));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { display_name: parsed.data.displayName },
      emailRedirectTo: `${publicEnv().NEXT_PUBLIC_SITE_URL}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) {
    const msg =
      error.code === "user_already_exists"
        ? "Ya existe una cuenta con ese correo"
        : "No pudimos crear tu cuenta. Intenta de nuevo.";
    return { error: msg, fields };
  }

  if (data.user) await track("user_registered", data.user.id);

  // Email confirmation disabled → we already have a session.
  if (data.session) redirect(next);
  return { message: "Te enviamos un correo para confirmar tu cuenta." };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
