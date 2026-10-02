import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { withdrawalsCsv } from "@/features/wallet/csv";

/** CSV of the withdrawals to pay on a given Tuesday (admins only; route handlers don't get the layout guard). */
export async function GET(request: Request) {
  await requireAdmin();
  const date = new URL(request.url).searchParams.get("date") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return new Response("Fecha inválida", { status: 400 });

  const supabase = await createClient(); // admin session (RLS: is_admin)
  const { data, error } = await supabase
    .from("withdrawals")
    .select("id, holder_name, clabe, bank_name, amount_cents")
    .eq("payout_date", date)
    .eq("status", "requested")
    .order("created_at");
  if (error) return new Response("Error", { status: 500 });

  return new Response(withdrawalsCsv(data ?? []), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="retiros-${date}.csv"`,
      "cache-control": "no-store",
    },
  });
}
