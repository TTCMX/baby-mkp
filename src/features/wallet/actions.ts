"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { track } from "@/lib/analytics/server";
import { parsePriceToCents } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { cleanClabe, isValidClabe } from "./clabe";
import { emailNotificationsSoon } from "@/features/notifications/emails";

export type WalletFormState = { ok?: string; error?: string; fieldErrors?: Record<string, string> } | undefined;

const accountSchema = z.object({
  clabe: z
    .string()
    .transform(cleanClabe)
    .refine((v) => v.length === 18, "La CLABE tiene 18 dígitos")
    .refine(isValidClabe, "Revisa tu CLABE: el último dígito no coincide"),
  holderName: z.string().trim().min(3, "Escribe el nombre completo del titular").max(120),
  bankName: z.string().trim().min(2, "Escribe el banco").max(80),
  // Express consent for financial data (LFPDPPP).
  consent: z.literal("on", { error: "Necesitamos tu autorización para usar estos datos" }),
});

/** Where withdrawals are sent. Owner-only row (RLS); a withdrawal keeps a snapshot of it. */
export async function saveBankAccount(_prev: WalletFormState, formData: FormData): Promise<WalletFormState> {
  const user = await requireUser("/balance");
  const parsed = accountSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { error: "Revisa los datos de tu cuenta", fieldErrors };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("bank_accounts").upsert(
    {
      user_id: user.id,
      clabe: parsed.data.clabe,
      holder_name: parsed.data.holderName,
      bank_name: parsed.data.bankName,
    },
    { onConflict: "user_id" },
  );
  if (error) {
    console.error("[wallet] save bank account failed", error);
    return { error: "No pudimos guardar tu cuenta. Intenta de nuevo." };
  }
  revalidatePath("/balance");
  return { ok: "Cuenta guardada" };
}

const WITHDRAWAL_ERRORS: Record<string, string> = {
  insufficient_balance: "No tienes saldo suficiente para ese monto.",
  amount_too_small: "El monto es menor al mínimo para retirar.",
  bank_account_required: "Primero guarda la cuenta a la que te enviamos el dinero.",
  not_allowed: "Tu cuenta no puede hacer retiros en este momento.",
};

export async function requestWithdrawal(_prev: WalletFormState, formData: FormData): Promise<WalletFormState> {
  const user = await requireUser("/balance");
  const amount = parsePriceToCents(String(formData.get("amount") ?? ""));
  if (!amount || amount <= 0)
    return { error: "Escribe cuánto quieres retirar", fieldErrors: { amount: "Monto inválido" } };

  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("request_withdrawal", { p_amount_cents: amount })
    .single<{ id: string; payout_date: string }>();
  if (error || !data) {
    const key = Object.keys(WITHDRAWAL_ERRORS).find((k) => error?.message.includes(k));
    if (!key) console.error("[wallet] withdrawal failed", error);
    return { error: key ? WITHDRAWAL_ERRORS[key] : "No pudimos registrar tu retiro. Intenta de nuevo." };
  }
  emailNotificationsSoon();
  await track("withdrawal_requested", user.id, { withdrawal_id: data.id, amount_cents: amount });
  revalidatePath("/balance");
  return { ok: data.payout_date };
}
