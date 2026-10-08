"use client";

import Link from "next/link";
import { startTransition, useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatPrice } from "@/lib/money";
import { saveBankAccount, requestWithdrawal, type WalletFormState } from "./actions";
import { bankFromClabe, cleanClabe, maskClabe } from "./clabe";
import { formatPayoutDate } from "./format";

type Account = { clabe: string; holder_name: string; bank_name: string } | null;

/** Where we send the money: CLABE, account holder and bank (suggested from the CLABE). */
export function BankAccountForm({ account }: { account: Account }) {
  const [state, action, pending] = useActionState<WalletFormState, FormData>(saveBankAccount, undefined);
  const [editing, setEditing] = useState(!account);
  const [clabe, setClabe] = useState(account?.clabe ?? "");
  const [bank, setBank] = useState(account?.bank_name ?? "");
  const [bankTouched, setBankTouched] = useState(Boolean(account));
  const err = state?.fieldErrors ?? {};
  // Close the form once a save succeeds (adjusting state when the action result changes).
  const [handled, setHandled] = useState(state);
  if (state !== handled) {
    setHandled(state);
    if (state?.ok) setEditing(false);
  }

  if (!editing && account) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl border bg-card p-4 text-sm">
        <div>
          <p className="font-bold">
            {account.bank_name} · {maskClabe(account.clabe)}
          </p>
          <p className="text-muted-foreground">{account.holder_name}</p>
          {state?.ok && <p className="mt-1 text-xs font-semibold text-accent-foreground">{state.ok}</p>}
        </div>
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          Cambiar
        </Button>
      </div>
    );
  }

  return (
    <form
      className="space-y-4 rounded-2xl border bg-card p-4"
      onSubmit={(e) => {
        // Manual submit: keeps what the seller typed if the server rejects it.
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(async () => {
          action(data);
        });
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="clabe">CLABE interbancaria (18 dígitos)</Label>
        <Input
          id="clabe"
          name="clabe"
          inputMode="numeric"
          autoComplete="off"
          value={clabe}
          maxLength={24}
          placeholder="002 180 00123456789 6"
          aria-invalid={!!err.clabe}
          onChange={(e) => {
            setClabe(e.target.value);
            const suggested = bankFromClabe(cleanClabe(e.target.value));
            if (suggested && !bankTouched) setBank(suggested);
          }}
        />
        {err.clabe && <p className="text-xs font-semibold text-destructive">{err.clabe}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="holderName">Nombre completo del titular</Label>
        <Input
          id="holderName"
          name="holderName"
          autoComplete="name"
          defaultValue={account?.holder_name}
          maxLength={120}
          aria-invalid={!!err.holderName}
        />
        {err.holderName && <p className="text-xs font-semibold text-destructive">{err.holderName}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="bankName">Banco</Label>
        <Input
          id="bankName"
          name="bankName"
          value={bank}
          maxLength={80}
          aria-invalid={!!err.bankName}
          onChange={(e) => {
            setBank(e.target.value);
            setBankTouched(true);
          }}
        />
        {err.bankName && <p className="text-xs font-semibold text-destructive">{err.bankName}</p>}
      </div>
      <label className="flex items-start gap-2.5 text-xs text-muted-foreground">
        <input type="checkbox" name="consent" value="on" required className="mt-0.5 size-4 shrink-0" />
        <span>
          Autorizo que usen estos datos bancarios para pagarme mis retiros, según el{" "}
          <Link href="/privacidad" className="font-semibold text-primary">
            Aviso de privacidad
          </Link>
          .
        </span>
      </label>
      {state?.error && (
        <p role="alert" className="text-sm font-semibold text-destructive">
          {state.error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Guardar cuenta"}
        </Button>
        {account && (
          <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
            Cancelar
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">Solo la usamos para enviarte tus retiros. Nadie más puede verla.</p>
    </form>
  );
}

/** Withdraw (part of) the balance; paid by SPEI on the next payout Tuesday. */
export function WithdrawForm({
  balanceCents,
  payoutDate,
  minCents,
  account,
}: {
  balanceCents: number;
  payoutDate: string;
  minCents: number;
  account: Account;
}) {
  const [state, action, pending] = useActionState<WalletFormState, FormData>(requestWithdrawal, undefined);
  const [amount, setAmount] = useState((balanceCents / 100).toFixed(2));

  if (state?.ok) {
    return (
      <div role="status" className="rounded-2xl bg-accent p-4 text-sm font-semibold text-accent-foreground">
        ¡Listo! Te enviamos tu dinero el {formatPayoutDate(state.ok)}
        {account && ` a ${account.bank_name} ${maskClabe(account.clabe)}`}.
      </div>
    );
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(async () => {
          action(data);
        });
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="amount">¿Cuánto quieres retirar?</Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">
              $
            </span>
            <Input
              id="amount"
              name="amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="pl-8"
            />
          </div>
          <Button type="button" variant="outline" onClick={() => setAmount((balanceCents / 100).toFixed(2))}>
            Todo
          </Button>
        </div>
        {minCents > 0 && <p className="text-xs text-muted-foreground">Mínimo {formatPrice(minCents)}.</p>}
      </div>
      {state?.error && (
        <p role="alert" className="text-sm font-semibold text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={pending || !account}>
        {pending ? "Registrando…" : "Retirar a mi cuenta"}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        {account
          ? `Si lo pides hoy, lo recibes el ${formatPayoutDate(payoutDate)} por SPEI. Pagamos los martes lo solicitado hasta el viernes anterior.`
          : "Guarda primero la cuenta a la que te enviamos el dinero."}
      </p>
    </form>
  );
}
