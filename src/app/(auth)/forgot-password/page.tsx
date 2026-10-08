import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "@/features/auth/password-forms";

export const metadata: Metadata = { title: "Recuperar contraseña" };

export default async function ForgotPasswordPage({ searchParams }: PageProps<"/forgot-password">) {
  const { error } = await searchParams;
  return (
    <>
      <h1 className="text-2xl font-extrabold">¿Olvidaste tu contraseña?</h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">
        Te enviamos un enlace a tu correo para que crees una nueva.
      </p>
      {error && (
        <p role="alert" className="mb-4 text-sm font-semibold text-destructive">
          Ese enlace ya no sirve: vence en 1 hora, solo se puede usar una vez y debe abrirse desde el último correo que
          pediste. Pide uno nuevo aquí.
        </p>
      )}
      <ForgotPasswordForm />
      <p className="mt-4 text-center text-sm text-muted-foreground">
        <Link href="/login" className="font-semibold text-primary">
          Volver a entrar
        </Link>
      </p>
    </>
  );
}
