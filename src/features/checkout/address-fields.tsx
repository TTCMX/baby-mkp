"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// The address inputs shared by checkout (where to deliver) and orders (where a
// package leaves from). Field names match `addressSchema`.

export type SavedAddress = Partial<{
  recipientName: string;
  phone: string;
  street: string;
  exteriorNumber: string;
  interiorNumber: string;
  neighborhood: string;
  municipality: string;
  city: string;
  state: string;
  postalCode: string;
  references: string;
}>;

export function AddressFields({ saved, err }: { saved: SavedAddress; err: (name: string) => string | undefined }) {
  return (
    <>
      <Field
        label="Nombre de quien recibe"
        name="recipientName"
        autoComplete="name"
        defaultValue={saved.recipientName}
        error={err("recipientName")}
      />
      <Field
        label="Teléfono"
        name="phone"
        type="tel"
        autoComplete="tel"
        defaultValue={saved.phone}
        error={err("phone")}
      />
      <Field
        label="Calle"
        name="street"
        autoComplete="address-line1"
        defaultValue={saved.street}
        error={err("street")}
      />
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Núm. exterior"
          name="exteriorNumber"
          defaultValue={saved.exteriorNumber}
          error={err("exteriorNumber")}
        />
        <Field label="Núm. interior (opcional)" name="interiorNumber" defaultValue={saved.interiorNumber} />
      </div>
      <Field label="Colonia" name="neighborhood" defaultValue={saved.neighborhood} error={err("neighborhood")} />
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Código postal"
          name="postalCode"
          inputMode="numeric"
          autoComplete="postal-code"
          maxLength={5}
          defaultValue={saved.postalCode}
          error={err("postalCode")}
        />
        <Field
          label="Alcaldía / municipio"
          name="municipality"
          defaultValue={saved.municipality}
          error={err("municipality")}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Ciudad" name="city" autoComplete="address-level2" defaultValue={saved.city} error={err("city")} />
        <Field
          label="Estado"
          name="state"
          autoComplete="address-level1"
          defaultValue={saved.state}
          error={err("state")}
        />
      </div>
      <Field label="Referencias (opcional)" name="references" defaultValue={saved.references} />
    </>
  );
}

function Field({
  label,
  name,
  error,
  ...props
}: { label: string; name: string; error?: string } & React.ComponentProps<"input">) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} aria-invalid={!!error} {...props} />
      {error && <p className="text-xs font-semibold text-destructive">{error}</p>}
    </div>
  );
}
