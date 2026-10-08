import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "@/features/auth/password-forms";

export const metadata: Metadata = { title: "Recuperar contraseña" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-2xl font-extrabold">¿Olvidaste tu contraseña?</h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">
        Te enviamos un enlace a tu correo para que crees una nueva.
      </p>
      <ForgotPasswordForm />
      <p className="mt-4 text-center text-sm text-muted-foreground">
        <Link href="/login" className="font-semibold text-primary">
          Volver a entrar
        </Link>
      </p>
    </>
  );
}
