import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { NewPasswordForm } from "@/features/auth/password-forms";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Nueva contraseña" };

// Reached from the reset email: the link already signed the user in.
export default async function ResetPasswordPage() {
  if (!(await getCurrentUser())) redirect("/login?error=link");
  return (
    <>
      <h1 className="text-2xl font-extrabold">Crea tu nueva contraseña</h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">Usa al menos 8 caracteres.</p>
      <NewPasswordForm />
    </>
  );
}
