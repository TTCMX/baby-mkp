"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn, signUp, type AuthFormState } from "./actions";

export function AuthForm({ mode, next }: { mode: "login" | "signup"; next?: string }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(
    mode === "login" ? signIn : signUp,
    undefined,
  );

  if (state?.message) {
    return <p className="rounded-xl bg-accent p-4 text-sm font-semibold text-accent-foreground">{state.message}</p>;
  }

  const nextQuery = next ? `?next=${encodeURIComponent(next)}` : "";

  return (
    <form action={action} className="space-y-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}

      {mode === "signup" && (
        <div className="space-y-2">
          <Label htmlFor="displayName">Nombre</Label>
          <Input
            id="displayName"
            name="displayName"
            autoComplete="given-name"
            required
            maxLength={60}
            defaultValue={state?.fields?.displayName}
          />
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="email">Correo</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required defaultValue={state?.fields?.email} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Contraseña</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          required
          minLength={8}
          maxLength={72}
        />
        {mode === "login" && (
          <Link href="/forgot-password" className="block text-right text-xs font-semibold text-primary">
            ¿Olvidaste tu contraseña?
          </Link>
        )}
      </div>

      {state?.error && (
        <p role="alert" className="text-sm font-semibold text-destructive">
          {state.error}
        </p>
      )}

      <Button type="submit" className="w-full" size="lg" disabled={pending}>
        {pending ? "Un momento…" : mode === "login" ? "Entrar" : "Crear cuenta"}
      </Button>

      {mode === "signup" && (
        <p className="text-center text-xs text-muted-foreground">
          Al crear tu cuenta aceptas los{" "}
          <Link href="/terminos" className="font-semibold text-primary">
            Términos y condiciones
          </Link>{" "}
          y el{" "}
          <Link href="/privacidad" className="font-semibold text-primary">
            Aviso de privacidad
          </Link>
          .
        </p>
      )}

      <p className="text-center text-sm text-muted-foreground">
        {mode === "login" ? (
          <>
            ¿Nuevo aquí?{" "}
            <Link href={`/signup${nextQuery}`} className="font-semibold text-primary">
              Crea tu cuenta
            </Link>
          </>
        ) : (
          <>
            ¿Ya tienes cuenta?{" "}
            <Link href={`/login${nextQuery}`} className="font-semibold text-primary">
              Entra
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
