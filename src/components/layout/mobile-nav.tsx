"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart, Home, MessageCircle, Plus, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/favorites", label: "Favoritos", icon: Heart },
  { href: "/sell/new", label: "Vender", icon: Plus, primary: true },
  { href: "/messages", label: "Mensajes", icon: MessageCircle },
  { href: "/settings", label: "Cuenta", icon: UserRound },
];

/** Bottom tab bar: the main navigation on phones. */
export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {items.map(({ href, label, icon: Icon, primary }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                className={cn(
                  "flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                {primary ? (
                  <span className="-mt-1 flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow">
                    <Icon className="size-5" />
                  </span>
                ) : (
                  <Icon className="size-5" />
                )}
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
