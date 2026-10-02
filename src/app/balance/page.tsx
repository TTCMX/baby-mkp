import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { formatPrice } from "@/lib/money";
import { getPlatformSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";
import { todayInMexico } from "@/features/babies/stages";
import { payoutDate } from "@/features/wallet/clabe";
import { formatPayoutDate } from "@/features/wallet/format";
import { getMyWallet, type WalletEntry, type Withdrawal } from "@/features/wallet/queries";
import { BankAccountForm, WithdrawForm } from "@/features/wallet/wallet-forms";

export const metadata: Metadata = { title: "Mi saldo" };

const dateFmt = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeZone: "America/Mexico_City" });

const ENTRY_LABELS: Record<WalletEntry["kind"], string> = {
  sale: "Venta",
  sale_reversal: "Venta reembolsada al comprador",
  purchase: "Compra con saldo",
  purchase_release: "Compra no completada: te lo devolvimos",
  refund: "Reembolso de una compra",
  withdrawal: "Retiro a tu cuenta",
  withdrawal_reversal: "Retiro no enviado: te lo devolvimos",
  adjustment: "Ajuste",
};

export default async function BalancePage() {
  const user = await requireUser("/balance");
  const [{ balance, entries, withdrawals, account }, settings] = await Promise.all([
    getMyWallet(user.id),
    getPlatformSettings(),
  ]);
  const pending = withdrawals.filter((w) => w.status === "requested");

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-2xl font-extrabold">Mi saldo</h1>

      <section className="rounded-[22px] bg-sky-wash p-6">
        <p className="text-sm font-bold text-secondary-foreground">Disponible</p>
        <p className="text-5xl font-extrabold tracking-tight">{formatPrice(balance)}</p>
        <p className="mt-2 text-sm text-[#3a4a66]">
          Lo que vendes llega aquí cuando el comprador confirma que lo recibió. Úsalo para comprar en mercadito.baby o
          retíralo a tu cuenta.
        </p>
        {balance > 0 && (
          <Link href="/search" className="mt-3 inline-block text-sm font-extrabold text-primary">
            Comprar con mi saldo →
          </Link>
        )}
      </section>

      {pending.length > 0 && (
        <section aria-labelledby="pending-heading" className="space-y-2">
          <h2 id="pending-heading" className="font-extrabold">
            Retiros en camino
          </h2>
          <ul className="divide-y rounded-2xl border bg-card text-sm">
            {pending.map((w) => (
              <li key={w.id} className="flex items-center justify-between gap-3 p-4">
                <span>
                  Llega el <b>{formatPayoutDate(w.payout_date)}</b>
                  <span className="block text-xs text-muted-foreground">
                    {w.bank_name} •••• {w.clabe.slice(-4)}
                  </span>
                </span>
                <span className="font-extrabold">{formatPrice(w.amount_cents)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="withdraw-heading" className="space-y-3">
        <h2 id="withdraw-heading" className="font-extrabold">
          Retirar a mi cuenta
        </h2>
        <BankAccountForm account={account} />
        {balance > 0 ? (
          <WithdrawForm
            balanceCents={balance}
            payoutDate={payoutDate(todayInMexico())}
            minCents={settings.withdrawal_min_cents}
            account={account}
          />
        ) : (
          <p className="text-sm text-muted-foreground">Cuando tengas saldo podrás retirarlo aquí.</p>
        )}
      </section>

      <section aria-labelledby="history-heading" className="space-y-2">
        <h2 id="history-heading" className="font-extrabold">
          Movimientos
        </h2>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aún no tienes movimientos.</p>
        ) : (
          <ul className="divide-y rounded-2xl border bg-card text-sm">
            {entries.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 p-4">
                <span className="min-w-0">
                  {e.order_id ? (
                    <Link href={`/orders/${e.order_id}`} className="font-semibold hover:underline">
                      {ENTRY_LABELS[e.kind]}
                    </Link>
                  ) : (
                    <span className="font-semibold">{ENTRY_LABELS[e.kind]}</span>
                  )}
                  <span className="block text-xs text-muted-foreground">
                    {dateFmt.format(new Date(e.created_at))}
                    {e.kind === "withdrawal" && withdrawalNote(withdrawals, e.withdrawal_id)}
                    {e.note && e.kind !== "sale" && ` · ${e.note}`}
                  </span>
                </span>
                <span className={cn("shrink-0 font-extrabold", e.amount_cents > 0 ? "text-accent-foreground" : "")}>
                  {e.amount_cents > 0 ? "+" : "−"} {formatPrice(Math.abs(e.amount_cents))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function withdrawalNote(withdrawals: Withdrawal[], id: string | null) {
  const w = withdrawals.find((x) => x.id === id);
  if (!w) return "";
  if (w.status === "paid") return " · Enviado";
  if (w.status === "failed") return ` · No se pudo enviar${w.failure_reason ? `: ${w.failure_reason}` : ""}`;
  return ` · Llega el ${formatPayoutDate(w.payout_date)}`;
}
