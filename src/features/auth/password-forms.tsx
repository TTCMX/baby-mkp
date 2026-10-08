"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordReset, updatePassword, type AuthFormState } from "./actions";

function ErrorText({ state }: { state: AuthFormState }) {
  return state?.error ? (
    <p role="alert" className="text-sm font-semibold text-destructive">
      {state.error}
    </p>
  ) : null;
}

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(requestPasswordReset, undefined);
  if (state?.message) {
    return <p className="rounded-xl bg-accent p-4 text-sm font-semibold text-accent-foreground">{state.message}</p>;
  }
  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Correo de tu cuenta</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required defaultValue={state?.fields?.email} />
      </div>
      <ErrorText state={state} />
      <Button type="submit" className="w-full" size="lg" disabled={pending}>
        {pending ? "Un momento…" : "Enviarme el enlace"}
      </Button>
    </form>
  );
}

export function NewPasswordForm() {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(updatePassword, undefined);
  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="password">Nueva contraseña</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={72}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm">Repítela</Label>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required maxLength={72} />
      </div>
      <ErrorText state={state} />
      <Button type="submit" className="w-full" size="lg" disabled={pending}>
        {pending ? "Guardando…" : "Guardar contraseña"}
      </Button>
    </form>
  );
}
