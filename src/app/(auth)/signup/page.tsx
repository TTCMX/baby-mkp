import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/features/auth/auth-form";
import { getCurrentUser } from "@/lib/auth";
import { safeNextPath } from "@/lib/safe-redirect";

export const metadata: Metadata = { title: "Crear cuenta" };

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const { next } = await searchParams;
  const nextPath = safeNextPath(next);
  if (await getCurrentUser()) redirect(nextPath);

  return (
    <>
      <h1 className="text-2xl font-extrabold">Crea tu cuenta</h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">Vende lo que tu bebé ya no usa en un par de minutos.</p>
      <AuthForm mode="signup" next={nextPath} />
    </>
  );
}
