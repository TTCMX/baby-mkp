"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AdminActionButton } from "./action-button";
import { attachShippingLabel, completeOrderAsAdmin, refundOrderAsAdmin, type AdminResult } from "./actions";

export function OrderControls({ id, status, openDispute }: { id: string; status: string; openDispute: boolean }) {
  const canComplete = ["paid", "in_delivery", "delivered"].includes(status);
  const canRefund = ["paid", "in_delivery", "delivered", "completed"].includes(status);
  if (!canComplete && !canRefund) return <p className="text-sm text-muted-foreground">Sin acciones disponibles.</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {canRefund && (
        <AdminActionButton
          label={openDispute ? "Resolver a favor del comprador (reembolso)" : "Reembolsar"}
          variant="destructive"
          askReason="Motivo del reembolso (lo verán comprador y vendedor). Se devolverá el total al comprador (tarjeta y saldo) y, si el vendedor ya recibió el saldo de esta venta, se le descontará:"
          action={(r) => refundOrderAsAdmin(id, r)}
        />
      )}
      {canComplete && (
        <AdminActionButton
          label={
            openDispute ? "Resolver a favor del vendedor (completar)" : "Completar (acredita el saldo al vendedor)"
          }
          variant="default"
          askReason="Nota de la resolución (la verán comprador y vendedor):"
          action={(r) => completeOrderAsAdmin(id, r)}
        />
      )}
    </div>
  );
}

/** Carrier, tracking number and the link to the prepaid label (PDF) the platform bought. */
export function ShippingLabelForm({
  id,
  current,
}: {
  id: string;
  current: { carrier: string | null; tracking: string | null; url: string | null };
}) {
  const [state, action, pending] = useActionState(
    (_prev: AdminResult | undefined, formData: FormData) => attachShippingLabel(id, formData),
    undefined,
  );
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="carrier">Paquetería</Label>
          <Input id="carrier" name="carrier" placeholder="Ej. Estafeta" defaultValue={current.carrier ?? ""} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tracking">Número de guía</Label>
          <Input id="tracking" name="tracking" defaultValue={current.tracking ?? ""} required />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="url">Enlace de la guía (PDF)</Label>
        <Input id="url" name="url" type="url" placeholder="https://…" defaultValue={current.url ?? ""} required />
        <p className="text-xs text-muted-foreground">
          El enlace que te da la paquetería o tu plataforma de guías, o un PDF compartido desde Drive.
        </p>
      </div>
      <Button type="submit" disabled={pending}>
        {current.url ? "Actualizar guía" : "Enviar guía al vendedor"}
      </Button>
      {state?.error && <p className="text-sm font-semibold text-destructive">{state.error}</p>}
      {state?.ok && <p className="text-sm font-semibold text-accent-foreground">{state.ok}</p>}
    </form>
  );
}
