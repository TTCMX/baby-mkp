"use client";

import { useActionState, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { bankFromClabe, cleanClabe } from "@/features/wallet/clabe";
import type { AdminResult } from "./actions";
import { AdminActionButton } from "./action-button";
import {
  deliverManagedOrder,
  saveManagedBankAccount,
  saveManagedContact,
  shipManagedOrder,
  withdrawForManaged,
} from "./managed-actions";

/** Per managed seller: their CLABE and withdrawals. */
export function ManagedSellerControls({
  id,
  balanceCents,
  account,
}: {
  id: string;
  balanceCents: number;
  account: { holder_name: string; bank_name: string } | null;
}) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<AdminResult>();
  const [pending, start] = useTransition();
  const [bank, setBank] = useState(account?.bank_name ?? "");

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        <Button size="sm" variant="outline" onClick={() => setOpen(!open)}>
          {account ? "Cambiar CLABE" : "Agregar CLABE"}
        </Button>
        {balanceCents > 0 && account && (
          <AdminActionButton
            label="Retirar saldo"
            variant="default"
            askReason={`Monto a retirar en pesos (saldo disponible: ${(balanceCents / 100).toFixed(2)}):`}
            action={(amount) => withdrawForManaged(id, amount)}
          />
        )}
      </div>
      {open && (
        <form
          className="grid w-full max-w-sm gap-2 rounded-xl border p-3 text-left"
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            start(async () => {
              const r = await saveManagedBankAccount(id, data);
              setResult(r);
              if (r.ok) setOpen(false);
            });
          }}
        >
          <Label htmlFor={`clabe-${id}`} className="text-xs">
            CLABE
          </Label>
          <Input
            id={`clabe-${id}`}
            name="clabe"
            inputMode="numeric"
            onChange={(e) => {
              const suggested = bankFromClabe(cleanClabe(e.target.value));
              if (suggested) setBank(suggested);
            }}
          />
          <Label htmlFor={`holder-${id}`} className="text-xs">
            Titular
          </Label>
          <Input id={`holder-${id}`} name="holderName" defaultValue={account?.holder_name} />
          <Label htmlFor={`bank-${id}`} className="text-xs">
            Banco
          </Label>
          <Input id={`bank-${id}`} name="bankName" value={bank} onChange={(e) => setBank(e.target.value)} />
          <Button size="sm" type="submit" disabled={pending}>
            Guardar
          </Button>
        </form>
      )}
      {result?.error && <span className="text-xs font-semibold text-destructive">{result.error}</span>}
      {result?.ok && <span className="text-xs font-semibold text-accent-foreground">{result.ok}</span>}
    </div>
  );
}

export function ManagedContactForm({ email, phone }: { email: string; phone: string }) {
  const [state, action, pending] = useActionState(saveManagedContact, undefined);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <div className="space-y-1">
        <Label htmlFor="mc-email" className="text-xs">
          Correo
        </Label>
        <Input id="mc-email" name="email" type="email" defaultValue={email} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="mc-phone" className="text-xs">
          Teléfono
        </Label>
        <Input id="mc-phone" name="phone" defaultValue={phone} maxLength={30} />
      </div>
      <Button type="submit" disabled={pending}>
        Guardar
      </Button>
      {state?.error && <p className="text-xs font-semibold text-destructive sm:col-span-3">{state.error}</p>}
      {state?.ok && <p className="text-xs font-semibold text-accent-foreground sm:col-span-3">{state.ok}</p>}
    </form>
  );
}

/** Delivery steps an admin runs for a managed seller's order. */
export function ManagedOrderControls({ id, status }: { id: string; status: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {status === "paid" && (
        <AdminActionButton
          label="Marcar enviado"
          askReason="Paquetería y guía (opcional), p. ej. DHL 1234567890:"
          action={(t) => shipManagedOrder(id, t)}
        />
      )}
      <AdminActionButton
        label="Marcar entregado"
        variant="default"
        confirm="¿El comprador ya tiene el producto? Le pediremos que lo confirme."
        action={() => deliverManagedOrder(id)}
      />
    </div>
  );
}
