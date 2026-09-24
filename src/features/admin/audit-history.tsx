import { createClient } from "@/lib/supabase/server";
import { auditLabel } from "@/features/admin/audit-labels";

const dateFmt = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Mexico_City",
});

/** Admin actions on one entity (read with the admin's session; RLS: admins only). */
export async function AuditHistory({ entityType, entityId }: { entityType: string; entityId: string }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("admin_audit_log")
    .select("id, action, details, created_at, admin:profiles(display_name)")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (!data?.length) return <p className="text-sm text-muted-foreground">Sin acciones de administración.</p>;
  return (
    <ul className="space-y-1.5 text-sm">
      {data.map((l) => {
        const details = l.details as { reason?: string; note?: string };
        return (
          <li key={l.id} className="rounded-xl bg-muted px-3 py-2">
            <span className="font-semibold">{auditLabel(l.action)}</span> ·{" "}
            {(l.admin as unknown as { display_name: string } | null)?.display_name} ·{" "}
            <span className="text-muted-foreground">{dateFmt.format(new Date(l.created_at))}</span>
            {(details?.reason || details?.note) && (
              <p className="text-muted-foreground">“{details.reason ?? details.note}”</p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
