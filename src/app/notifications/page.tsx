import type { Metadata } from "next";
import Link from "next/link";
import { Bell } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Avisos" };

const dateFmt = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Mexico_City",
});

export default async function NotificationsPage() {
  const user = await requireUser("/notifications");
  const supabase = await createClient();
  const { data: items } = await supabase
    .from("notifications")
    .select("id, title, body, link, read_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  // Opening the list marks everything as read (RLS: own rows, read_at only).
  if (items?.some((n) => !n.read_at)) {
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .is("read_at", null);
  }

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <h1 className="text-2xl font-extrabold">Avisos</h1>
      {!items?.length ? (
        <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          <Bell className="mx-auto mb-2 size-6" />
          Aquí verás las novedades de tus compras y ventas.
        </div>
      ) : (
        <ul className="divide-y rounded-2xl border bg-card">
          {items.map((n) => (
            <li key={n.id}>
              <Link href={n.link ?? "#"} className="flex gap-3 p-4 hover:bg-muted/50">
                <span
                  className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.read_at ? "bg-transparent" : "bg-primary")}
                  aria-label={n.read_at ? undefined : "Nuevo"}
                />
                <span className="min-w-0">
                  <span className="block text-sm font-bold">{n.title}</span>
                  {n.body && <span className="block text-sm text-muted-foreground">{n.body}</span>}
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {dateFmt.format(new Date(n.created_at))}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
