import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/features/auth/auth-form";
import { getCurrentUser } from "@/lib/auth";
import { safeNextPath } from "@/lib/safe-redirect";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error } = await searchParams;
  const nextPath = safeNextPath(next);
  if (await getCurrentUser()) redirect(nextPath);

  return (
    <>
      <h1 className="text-2xl font-extrabold">Hola de nuevo</h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">Entra para comprar, vender y guardar favoritos.</p>
      {error && (
        <p role="alert" className="mb-4 text-sm font-semibold text-destructive">
          No pudimos abrir tu sesión con ese enlace. Si ya confirmaste tu correo, entra con tu contraseña.
        </p>
      )}
      <AuthForm mode="login" next={nextPath} />
    </>
  );
}
