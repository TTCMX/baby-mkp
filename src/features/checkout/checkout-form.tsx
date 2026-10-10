"use client";

import { startTransition, useActionState, useState } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddressFields, type SavedAddress } from "./address-fields";
import { DELIVERY_METHODS, type DeliveryMethod } from "@/lib/domain/constants";
import { formatPrice } from "@/lib/money";
import { cn } from "@/lib/utils";
import { startCheckout, type CheckoutState } from "./actions";

export type { SavedAddress } from "./address-fields";

type Props = {
  listingId: string;
  priceCents: number;
  shippingPriceCents: number | null;
  deliveryMethods: DeliveryMethod[];
  sellerLocation: string;
  savedAddress: SavedAddress;
  /** Buyer's available balance; applied first, the card pays the rest. */
  balanceCents: number;
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
  balanceCents,
}: Props) {
  const [state, action, pending] = useActionState<CheckoutState, FormData>(startCheckout, undefined);
  const [method, setMethod] = useState<DeliveryMethod>(deliveryMethods[0]);
  const shipping = method === "shipping" ? (shippingPriceCents ?? 0) : 0;
  const needsAddress = method !== "pickup";
  const total = priceCents + shipping;
  const [useBalance, setUseBalance] = useState(balanceCents > 0);
  const applied = useBalance ? Math.min(balanceCents, total) : 0;
  const card = total - applied;
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
          <AddressFields saved={savedAddress} err={err} />
        </fieldset>
      )}

      <section className="space-y-2 rounded-2xl border bg-card p-4 text-sm">
        <Row label="Producto" value={formatPrice(priceCents)} />
        <Row label="Envío" value={method === "shipping" ? (shipping ? formatPrice(shipping) : "Incluido") : "—"} />
        <div className="border-t pt-2">
          <Row
            label={<span className="text-base font-extrabold">Total</span>}
            value={<span className="text-base font-extrabold">{formatPrice(total)}</span>}
          />
        </div>
        {applied > 0 && (
          <>
            <Row label="Pagas con tu saldo" value={`− ${formatPrice(applied)}`} />
            {card > 0 && <Row label={<b>Pagas con tarjeta</b>} value={<b>{formatPrice(card)}</b>} />}
          </>
        )}
      </section>

      {balanceCents > 0 && (
        <label className="flex items-start gap-3 rounded-2xl border bg-card p-4 text-sm">
          <input
            type="checkbox"
            name="useBalance"
            checked={useBalance}
            onChange={(e) => setUseBalance(e.target.checked)}
            className="mt-0.5 size-4 accent-primary"
          />
          <span>
            <span className="block font-bold">Usar mi saldo</span>
            <span className="text-muted-foreground">
              Tienes {formatPrice(balanceCents)} disponibles
              {balanceCents >= total ? "; alcanza para todo." : "; el resto lo pagas con tarjeta."}
            </span>
          </span>
        </label>
      )}

      {state?.error && (
        <p role="alert" className="text-sm font-semibold text-destructive">
          {state.error}
        </p>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        <Lock /> {pending ? "Preparando pago…" : card === 0 ? "Pagar con mi saldo" : `Pagar ${formatPrice(card)}`}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        {card === 0 ? "Pagas con tu saldo." : "Pago seguro con Stripe."} Guardamos tu dinero hasta que recibas tu
        producto.
      </p>
    </form>
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
