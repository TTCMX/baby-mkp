"use client";

import type { ListingStatus } from "@/lib/domain/constants";
import { AdminActionButton } from "./action-button";
import { moveListing } from "./actions";

/** The moderation actions that make sense for a listing in its current status. */
export function ListingControls({ id, status }: { id: string; status: ListingStatus }) {
  return (
    <div className="flex flex-wrap gap-2">
      {status === "pending_review" && (
        <AdminActionButton label="Aprobar" variant="default" action={() => moveListing(id, "approve")} />
      )}
      {["pending_review", "active", "inactive"].includes(status) && (
        <AdminActionButton
          label="Rechazar"
          variant="destructive"
          askReason="Motivo del rechazo (se le muestra al vendedor):"
          action={(r) => moveListing(id, "reject", r)}
        />
      )}
      {["active", "pending_review"].includes(status) && (
        <AdminActionButton
          label="Desactivar"
          askReason="Motivo (se le muestra al vendedor, opcional):"
          action={(r) => moveListing(id, "deactivate", r)}
        />
      )}
      {["inactive", "rejected"].includes(status) && (
        <AdminActionButton label="Reactivar" action={() => moveListing(id, "reactivate")} />
      )}
      {["active", "inactive"].includes(status) && (
        <AdminActionButton
          label="Marcar vendido"
          confirm="¿Marcar como vendido fuera de la plataforma?"
          action={() => moveListing(id, "mark_sold")}
        />
      )}
    </div>
  );
}
