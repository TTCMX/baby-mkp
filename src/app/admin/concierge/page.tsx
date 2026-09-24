import { formatPrice } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Concierge" };

export default async function AdminConcierge() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("concierge_requests")
    .select(
      "id, title, expected_price_cents, status, created_at, user:profiles!concierge_requests_user_id_fkey(username)",
    )
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="space-y-3">
      <p className="rounded-2xl bg-muted p-4 text-sm">
        El flujo &quot;Véndelo por mí&quot; (solicitud del usuario, aceptar/rechazar, gestión del listing) llega en la
        siguiente etapa. Aquí aparecerán las solicitudes.
      </p>
      <ul className="divide-y rounded-2xl border bg-card text-sm">
        {(data ?? []).map((r) => (
          <li key={r.id} className="flex justify-between p-3">
            <span>
              {r.title} · @{(r.user as unknown as { username: string }).username}
            </span>
            <span>
              {formatPrice(r.expected_price_cents)} · {r.status}
            </span>
          </li>
        ))}
        {!data?.length && <li className="p-6 text-center text-muted-foreground">Sin solicitudes.</li>}
      </ul>
    </div>
  );
}
