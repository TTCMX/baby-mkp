"use client";

import { AdminActionButton } from "./action-button";
import { setUserStatus } from "./actions";

export function UserControls({ id, status, isAdmin }: { id: string; status: string; isAdmin: boolean }) {
  if (isAdmin) return <span className="text-xs font-semibold text-muted-foreground">Administrador</span>;
  return status === "suspended" ? (
    <AdminActionButton
      label="Reactivar"
      action={(r) => setUserStatus(id, "active", r)}
      confirm="¿Reactivar esta cuenta?"
    />
  ) : (
    <AdminActionButton
      label="Suspender"
      variant="destructive"
      askReason="Motivo de la suspensión (queda en la bitácora). Sus productos activos se pausarán:"
      action={(r) => setUserStatus(id, "suspended", r)}
    />
  );
}
