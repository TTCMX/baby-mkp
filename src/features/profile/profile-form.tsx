"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateProfile, type ProfileFormState } from "./actions";

type Props = {
  profile: {
    display_name: string;
    username: string;
    city: string | null;
    municipality: string | null;
    bio: string | null;
  };
  phone: string | null;
};

export function ProfileForm({ profile, phone }: Props) {
  const [state, action, pending] = useActionState<ProfileFormState, FormData>(updateProfile, undefined);

  return (
    <form action={action} className="space-y-4">
      <fieldset className="space-y-4">
        <legend className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Perfil público</legend>
        <Field label="Nombre" name="displayName" defaultValue={profile.display_name} required maxLength={60} />
        <Field
          label="Usuario"
          name="username"
          defaultValue={profile.username}
          required
          maxLength={30}
          pattern="[a-z0-9_]{3,30}"
        />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Ciudad" name="city" defaultValue={profile.city ?? ""} maxLength={80} />
          <Field
            label="Alcaldía / municipio"
            name="municipality"
            defaultValue={profile.municipality ?? ""}
            maxLength={80}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bio">Sobre ti</Label>
          <textarea
            id="bio"
            name="bio"
            maxLength={500}
            rows={3}
            defaultValue={profile.bio ?? ""}
            className="w-full rounded-xl border border-input bg-card px-4 py-3 text-base outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30 md:text-sm"
          />
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Privado (nunca se muestra)
        </legend>
        <Field label="Teléfono" name="phone" type="tel" defaultValue={phone ?? ""} maxLength={20} autoComplete="tel" />
      </fieldset>

      {state?.error && (
        <p role="alert" className="text-sm font-semibold text-destructive">
          {state.error}
        </p>
      )}
      {state?.ok && <p className="text-sm font-semibold text-accent-foreground">Cambios guardados</p>}

      <Button type="submit" className="w-full sm:w-auto" disabled={pending}>
        {pending ? "Guardando…" : "Guardar"}
      </Button>
    </form>
  );
}

function Field({ label, name, ...props }: { label: string; name: string } & React.ComponentProps<"input">) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} {...props} />
    </div>
  );
}
