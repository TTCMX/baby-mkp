"use client";

import { startTransition, useActionState, useState } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DELIVERY_METHODS, type DeliveryMethod } from "@/lib/domain/constants";
import { formatPrice } from "@/lib/money";
import { cn } from "@/lib/utils";
import { startCheckout, type CheckoutState } from "./actions";

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

type Props = {
  listingId: string;
  priceCents: number;
  shippingPriceCents: number | null;
  deliveryMethods: DeliveryMethod[];
  sellerLocation: string;
  savedAddress: SavedAddress;
};

const DELIVERY_HINTS: Record<DeliveryMethod, string> = {
  shipping: "El vendedor te lo envía por paquetería",
  local_delivery: "El vendedor te lo lleva en su ciudad",
  pickup: "Pasas por él y lo revisas en persona",
};

export function CheckoutForm({
  listingId,
  priceCents,
  shippingPriceCents,
  deliveryMethods,
  sellerLocation,
  savedAddress,
}: Props) {
  const [state, action, pending] = useActionState<CheckoutState, FormData>(startCheckout, undefined);
  const [method, setMethod] = useState<DeliveryMethod>(deliveryMethods[0]);
  const shipping = method === "shipping" ? (shippingPriceCents ?? 0) : 0;
  const needsAddress = method !== "pickup";
  // Hide a field's error as soon as the buyer edits it (until the next submit).
  const [edited, setEdited] = useState<Set<string>>(new Set());
  const err = (k: string) => (edited.has(k) ? undefined : state?.fieldErrors?.[k]);

  return (
    <form
      className="space-y-6"
      onChange={(e) => {
        const target = e.target;
        if (!(target instanceof HTMLInputElement)) return;
        if (state?.fieldErrors?.[target.name] && !edited.has(target.name)) setEdited(new Set(edited).add(target.name));
      }}
      onSubmit={(e) => {
        // Submit manually: a plain `action={...}` makes React reset the form after
        // each attempt, wiping what the buyer typed and the chosen delivery option.
        e.preventDefault();
        setEdited(new Set());
        const data = new FormData(e.currentTarget);
        startTransition(() => action(data));
      }}
    >
      <input type="hidden" name="listingId" value={listingId} />

      <fieldset className="space-y-2">
        <legend className="mb-2 font-extrabold">¿Cómo lo quieres recibir?</legend>
        {deliveryMethods.map((m) => (
          <label
            key={m}
            className={cn(
              "flex cursor-pointer items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3",
              method === m && "border-primary ring-2 ring-primary/30",
            )}
          >
            <span className="flex items-center gap-3">
              <input
                type="radio"
                name="deliveryMethod"
                value={m}
                checked={method === m}
                onChange={() => setMethod(m)}
                className="size-4 accent-[var(--primary)]"
              />
              <span>
                <span className="block text-sm font-bold">{DELIVERY_METHODS[m]}</span>
                <span className="block text-xs text-muted-foreground">
                  {m === "pickup" ? `En ${sellerLocation}` : DELIVERY_HINTS[m]}
                </span>
              </span>
            </span>
            <span className="text-sm font-semibold">
              {m === "shipping" ? (shippingPriceCents ? formatPrice(shippingPriceCents) : "Incluido") : "Gratis"}
            </span>
          </label>
        ))}
      </fieldset>

      {needsAddress && (
        <fieldset className="space-y-3">
          <legend className="mb-2 font-extrabold">¿A dónde?</legend>
          <p className="-mt-1 text-xs text-muted-foreground">
            Solo el vendedor verá tu dirección, y solo después de pagar.
          </p>
          <Field
            label="Nombre de quien recibe"
            name="recipientName"
            autoComplete="name"
            defaultValue={savedAddress.recipientName}
            error={err("recipientName")}
          />
          <Field
            label="Teléfono"
            name="phone"
            type="tel"
            autoComplete="tel"
            defaultValue={savedAddress.phone}
            error={err("phone")}
          />
          <Field
            label="Calle"
            name="street"
            autoComplete="address-line1"
            defaultValue={savedAddress.street}
            error={err("street")}
          />
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Núm. exterior"
              name="exteriorNumber"
              defaultValue={savedAddress.exteriorNumber}
              error={err("exteriorNumber")}
            />
            <Field label="Núm. interior (opcional)" name="interiorNumber" defaultValue={savedAddress.interiorNumber} />
          </div>
          <Field
            label="Colonia"
            name="neighborhood"
            defaultValue={savedAddress.neighborhood}
            error={err("neighborhood")}
          />
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Código postal"
              name="postalCode"
              inputMode="numeric"
              autoComplete="postal-code"
              maxLength={5}
              defaultValue={savedAddress.postalCode}
              error={err("postalCode")}
            />
            <Field
              label="Alcaldía / municipio"
              name="municipality"
              defaultValue={savedAddress.municipality}
              error={err("municipality")}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Ciudad"
              name="city"
              autoComplete="address-level2"
              defaultValue={savedAddress.city}
              error={err("city")}
            />
            <Field
              label="Estado"
              name="state"
              autoComplete="address-level1"
              defaultValue={savedAddress.state}
              error={err("state")}
            />
          </div>
          <Field label="Referencias (opcional)" name="references" defaultValue={savedAddress.references} />
        </fieldset>
      )}

      <section className="space-y-2 rounded-2xl border bg-card p-4 text-sm">
        <Row label="Producto" value={formatPrice(priceCents)} />
        <Row label="Envío" value={method === "shipping" ? (shipping ? formatPrice(shipping) : "Incluido") : "—"} />
        <div className="border-t pt-2">
          <Row
            label={<span className="text-base font-extrabold">Total</span>}
            value={<span className="text-base font-extrabold">{formatPrice(priceCents + shipping)}</span>}
          />
        </div>
      </section>

      {state?.error && (
        <p role="alert" className="text-sm font-semibold text-destructive">
          {state.error}
        </p>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        <Lock /> {pending ? "Preparando pago…" : `Pagar ${formatPrice(priceCents + shipping)}`}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Pago seguro con Stripe. Guardamos tu dinero hasta que recibas tu producto.
      </p>
    </form>
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

function Row({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
