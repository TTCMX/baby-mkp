"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  ["/admin", "Resumen"],
  ["/admin/listings", "Productos"],
  ["/admin/orders", "Pedidos"],
  ["/admin/users", "Usuarios"],
  ["/admin/concierge", "Concierge"],
  ["/admin/settings", "Configuración"],
] as const;

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:px-0">
      {TABS.map(([href, label]) => {
        const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "shrink-0 rounded-full px-4 py-2 text-sm font-bold",
              active ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:bg-muted/70",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
