"use client";

import { AdminActionButton } from "./action-button";
import { completeOrderAsAdmin, refundOrderAsAdmin } from "./actions";

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
          askReason="Motivo del reembolso (lo verán comprador y vendedor). Se devolverá el total al comprador y, si ya se pagó al vendedor, se revertirá la transferencia:"
          action={(r) => refundOrderAsAdmin(id, r)}
        />
      )}
      {canComplete && (
        <AdminActionButton
          label={openDispute ? "Resolver a favor del vendedor (completar)" : "Completar y liberar pago"}
          variant="default"
          askReason="Nota de la resolución (la verán comprador y vendedor):"
          action={(r) => completeOrderAsAdmin(id, r)}
        />
      )}
    </div>
  );
}
