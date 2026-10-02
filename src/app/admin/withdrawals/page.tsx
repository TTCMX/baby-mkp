import Link from "next/link";
import { Download } from "lucide-react";
import { formatPrice } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { WithdrawalControls } from "@/features/admin/withdrawal-controls";
import { formatPayoutDate } from "@/features/wallet/format";

export const metadata = { title: "Retiros" };

const dateFmt = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Mexico_City",
});

type Row = {
  id: string;
  user_id: string;
  amount_cents: number;
  status: "requested" | "paid" | "failed";
  payout_date: string;
  clabe: string;
  holder_name: string;
  bank_name: string;
  reference: string | null;
  failure_reason: string | null;
  created_at: string;
  processed_at: string | null;
  user: { username: string } | null;
};

const COLUMNS =
  "id, user_id, amount_cents, status, payout_date, clabe, holder_name, bank_name, reference, failure_reason, created_at, processed_at, user:profiles!withdrawals_user_id_fkey(username)";

export default async function AdminWithdrawals() {
  const supabase = await createClient(); // admin session (RLS: is_admin)
  const [{ data: open }, { data: done }] = await Promise.all([
    supabase.from("withdrawals").select(COLUMNS).eq("status", "requested").order("payout_date").order("created_at"),
    supabase
      .from("withdrawals")
      .select(COLUMNS)
      .neq("status", "requested")
      .order("processed_at", { ascending: false })
      .limit(30),
  ]);

  // Pending withdrawals grouped by the Tuesday they're due.
  const groups = new Map<string, Row[]>();
  for (const w of (open ?? []) as unknown as Row[])
    groups.set(w.payout_date, [...(groups.get(w.payout_date) ?? []), w]);

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Se pagan los martes por SPEI lo solicitado hasta el viernes anterior (23:59, hora del centro). Descarga el CSV,
        haz las transferencias desde tu banco y marca cada retiro como pagado. Si uno rebota, márcalo como no pagado: el
        monto regresa al saldo del usuario.
      </p>

      {groups.size === 0 && (
        <p className="rounded-2xl border border-dashed p-6 text-center">No hay retiros por pagar.</p>
      )}

      {[...groups].map(([date, rows]) => (
        <section key={date} className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-extrabold first-letter:uppercase">
              {formatPayoutDate(date)} · {rows.length} {rows.length === 1 ? "retiro" : "retiros"} ·{" "}
              {formatPrice(rows.reduce((s, r) => s + r.amount_cents, 0))}
            </h2>
            <a
              href={`/admin/withdrawals/export?date=${date}`}
              className={buttonVariants({ size: "sm", variant: "outline" })}
            >
              <Download /> CSV
            </a>
          </div>
          <ul className="divide-y rounded-2xl border bg-card text-sm">
            {rows.map((w) => (
              <li key={w.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="font-bold">
                    {formatPrice(w.amount_cents)} · {w.holder_name}
                  </p>
                  <p className="font-mono text-xs">
                    {w.clabe} · {w.bank_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {w.user && (
                      <Link href={`/admin/users?q=${w.user.username}`} className="text-primary">
                        @{w.user.username}
                      </Link>
                    )}{" "}
                    · pedido el {dateFmt.format(new Date(w.created_at))}
                  </p>
                </div>
                <WithdrawalControls id={w.id} />
              </li>
            ))}
          </ul>
        </section>
      ))}

      {(done ?? []).length > 0 && (
        <section className="space-y-2">
          <h2 className="font-extrabold">Procesados recientemente</h2>
          <ul className="divide-y rounded-2xl border bg-card text-sm">
            {((done ?? []) as unknown as Row[]).map((w) => (
              <li key={w.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
                <span>
                  {formatPrice(w.amount_cents)} · {w.holder_name}
                  <span className="block text-xs text-muted-foreground">
                    {w.bank_name} •••• {w.clabe.slice(-4)} ·{" "}
                    {w.processed_at && dateFmt.format(new Date(w.processed_at))}
                    {w.reference && ` · ref. ${w.reference}`}
                    {w.failure_reason && ` · ${w.failure_reason}`}
                  </span>
                </span>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-xs font-bold",
                    w.status === "paid" ? "bg-accent text-accent-foreground" : "bg-destructive/10 text-destructive",
                  )}
                >
                  {w.status === "paid" ? "Pagado" : "No pagado"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
