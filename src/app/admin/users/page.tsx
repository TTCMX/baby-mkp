import Link from "next/link";
import { Star } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { cleanText } from "@/features/catalog/filters";
import { UserControls } from "@/features/admin/user-controls";

export const metadata = { title: "Usuarios" };

const monthFmt = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeZone: "America/Mexico_City" });

export default async function AdminUsers({ searchParams }: PageProps<"/admin/users">) {
  const sp = await searchParams;
  const q = cleanText(typeof sp.q === "string" ? sp.q : "", 80).replace(/[,()]/g, "");
  const suspended = sp.status === "suspended";

  const supabase = await createClient(); // admin session: RLS allows reading private_profiles
  let ids: string[] | null = null;
  if (q) {
    const [{ data: byName }, { data: byEmail }] = await Promise.all([
      supabase.from("profiles").select("id").or(`username.ilike.*${q}*,display_name.ilike.*${q}*`).limit(50),
      supabase.from("private_profiles").select("id").ilike("email", `%${q}%`).limit(50),
    ]);
    ids = [...new Set([...(byName ?? []), ...(byEmail ?? [])].map((r) => r.id as string))];
  }

  let query = supabase
    .from("profiles")
    .select("id, username, display_name, city, role, status, sales_count, rating_avg, rating_count, created_at", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .limit(50);
  if (ids) query = query.in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  if (suspended) query = query.eq("status", "suspended");
  const { data: users, count } = await query;

  const userIds = (users ?? []).map((u) => u.id);
  const [{ data: privates }, { data: listingCounts }] = await Promise.all([
    supabase.from("private_profiles").select("id, email, phone, payouts_enabled, stripe_account_id").in("id", userIds),
    supabase.from("listings").select("seller_id").eq("status", "active").in("seller_id", userIds),
  ]);
  const priv = new Map((privates ?? []).map((p) => [p.id, p]));
  const active = (id: string) => (listingCounts ?? []).filter((l) => l.seller_id === id).length;

  return (
    <div className="space-y-4">
      <form className="flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar por nombre, usuario o correo…"
          className="h-10 flex-1 rounded-full border border-input bg-card px-4 text-sm"
        />
      </form>
      <nav className="flex gap-1.5 text-xs">
        <Link
          href="/admin/users"
          className={`rounded-full px-3 py-1 font-semibold ${!suspended ? "bg-foreground text-background" : "bg-muted"}`}
        >
          Todos
        </Link>
        <Link
          href="/admin/users?status=suspended"
          className={`rounded-full px-3 py-1 font-semibold ${suspended ? "bg-foreground text-background" : "bg-muted"}`}
        >
          Suspendidos
        </Link>
      </nav>
      <p className="text-sm text-muted-foreground">{count ?? 0} usuarios</p>
      <ul className="divide-y rounded-2xl border bg-card">
        {(users ?? []).map((u) => {
          const p = priv.get(u.id);
          return (
            <li key={u.id} className="flex flex-wrap items-start justify-between gap-3 p-3 text-sm">
              <div className="min-w-0 space-y-0.5">
                <p className="font-bold">
                  {u.display_name}{" "}
                  <Link href={`/profile/${u.username}`} className="font-normal text-primary">
                    @{u.username}
                  </Link>
                  {u.status === "suspended" && (
                    <span className="ml-2 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-bold text-destructive">
                      Suspendido
                    </span>
                  )}
                </p>
                <p className="text-muted-foreground">
                  {p?.email}
                  {p?.phone && ` · ${p.phone}`}
                </p>
                <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                  <span>{u.sales_count} ventas</span>
                  <span className="inline-flex items-center gap-0.5">
                    <Star className="size-3" />{" "}
                    {u.rating_count ? `${Number(u.rating_avg).toFixed(1)} (${u.rating_count})` : "—"}
                  </span>
                  <span>{active(u.id)} en venta</span>
                  <span>
                    Cobros: {p?.payouts_enabled ? "activos" : p?.stripe_account_id ? "en proceso" : "sin configurar"}
                  </span>
                  <span>Desde {monthFmt.format(new Date(u.created_at))}</span>
                </p>
              </div>
              <UserControls id={u.id} status={u.status} isAdmin={u.role === "admin"} />
            </li>
          );
        })}
        {!users?.length && <li className="p-6 text-center text-sm text-muted-foreground">Sin resultados.</li>}
      </ul>
    </div>
  );
}
