"use client";

import { AdminActionButton } from "./action-button";
import { settleWithdrawalAsAdmin } from "./actions";

export function WithdrawalControls({ id }: { id: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      <AdminActionButton
        label="Pagado"
        variant="default"
        askReason="Clave de rastreo o referencia del SPEI (opcional):"
        action={(r) => settleWithdrawalAsAdmin(id, true, r)}
      />
      <AdminActionButton
        label="No se pudo pagar"
        askReason="Motivo (lo verá el usuario; el monto regresa a su saldo):"
        action={(r) => settleWithdrawalAsAdmin(id, false, r)}
      />
    </div>
  );
}
