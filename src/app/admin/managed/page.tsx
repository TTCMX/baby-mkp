import Link from "next/link";
import { Upload } from "lucide-react";
import { formatPrice } from "@/lib/money";
import { getPlatformSettings } from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { ManagedContactForm, ManagedSellerControls } from "@/features/admin/managed-controls";
import { maskClabe } from "@/features/wallet/clabe";

export const metadata = { title: "Vendedores gestionados" };

type Seller = { id: string; username: string; display_name: string; sales_count: number };

export default async function ManagedSellers() {
  const supabase = await createClient(); // admin session (RLS: is_admin)
  const [{ data: sellers }, settings, { count: toDeliver }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, username, display_name, sales_count")
      .eq("is_managed", true)
      .order("display_name")
      .limit(1000),
    getPlatformSettings(),
    supabase
      .from("orders")
      .select("id, seller:profiles!orders_seller_id_fkey!inner(is_managed)", { count: "exact", head: true })
      .eq("seller.is_managed", true)
      .in("status", ["paid", "in_delivery"]),
  ]);
  const ids = (sellers ?? []).map((s) => s.id);
  const [{ data: privates }, { data: wallets }, { data: accounts }, { data: active }] = await Promise.all([
    supabase.from("private_profiles").select("id, owner_name, owner_email, phone").in("id", ids),
    supabase.from("wallets").select("user_id, balance_cents").in("user_id", ids),
    supabase.from("bank_accounts").select("user_id, clabe, holder_name, bank_name").in("user_id", ids),
    supabase.from("listings").select("seller_id").eq("status", "active").in("seller_id", ids),
  ]);
  const by = <T extends Record<string, unknown>>(rows: T[] | null, key: keyof T) =>
    new Map((rows ?? []).map((r) => [r[key] as string, r]));
  const priv = by(privates, "id");
  const wallet = by(wallets, "user_id");
  const account = by(accounts, "user_id");
  const activeCount = (id: string) => (active ?? []).filter((l) => l.seller_id === id).length;
  const totalBalance = (wallets ?? []).reduce((s, w) => s + w.balance_cents, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {(sellers ?? []).length} vendedores · saldo total {formatPrice(totalBalance)}
        </p>
        <Link href="/admin/managed/import" className={buttonVariants()}>
          <Upload /> Importar productos
        </Link>
      </div>

      {(toDeliver ?? 0) > 0 && (
        <Link
          href="/admin/orders?managed=1"
          className="inline-flex rounded-full border border-primary/40 bg-primary/5 px-3 py-1.5 text-sm font-semibold"
        >
          {toDeliver} ventas por entregar →
        </Link>
      )}

      <section className="space-y-2 rounded-2xl border bg-card p-5 text-sm">
        <h2 className="font-extrabold">Contacto para compradores</h2>
        <p className="text-muted-foreground">
          Quien compra un producto gestionado ve este contacto (no el de la dueña) para coordinar la entrega.
        </p>
        <ManagedContactForm email={settings.managed_contact_email} phone={settings.managed_contact_phone} />
      </section>

      {(sellers ?? []).length === 0 ? (
        <p className="rounded-2xl border border-dashed p-6 text-center">
          Aún no hay vendedores gestionados. Impórtalos desde un archivo.
        </p>
      ) : (
        <ul className="divide-y rounded-2xl border bg-card text-sm">
          {(sellers as Seller[]).map((s) => {
            const p = priv.get(s.id);
            const acct = account.get(s.id);
            const balance = wallet.get(s.id)?.balance_cents ?? 0;
            return (
              <li key={s.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="font-bold">
                    <Link href={`/profile/${s.username}`} className="hover:underline">
                      {s.display_name}
                    </Link>{" "}
                    <span className="font-normal text-muted-foreground">· {p?.owner_name}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {[p?.owner_email, p?.phone].filter(Boolean).join(" · ") || "Sin contacto"}
                  </p>
                  <p className="text-xs">
                    {activeCount(s.id)} en venta · {s.sales_count} vendidos · saldo <b>{formatPrice(balance)}</b> ·{" "}
                    {acct ? `${acct.bank_name} ${maskClabe(acct.clabe)}` : "sin CLABE"}
                  </p>
                </div>
                <ManagedSellerControls
                  id={s.id}
                  balanceCents={balance}
                  account={acct ? { holder_name: acct.holder_name, bank_name: acct.bank_name } : null}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
