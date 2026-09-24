import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/** Every admin write is recorded: who, what, on which entity, with which details. */
export async function logAdminAction(
  adminId: string,
  action: string,
  entityType: "listing" | "user" | "order" | "setting" | "category",
  entityId: string,
  details: Record<string, unknown> = {},
) {
  const { error } = await createAdminClient()
    .from("admin_audit_log")
    .insert({ admin_id: adminId, action, entity_type: entityType, entity_id: entityId, details });
  if (error) console.error("[admin] audit log failed", error);
}
