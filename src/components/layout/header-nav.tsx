"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Para ti" },
  { href: "/search", label: "Explorar" },
];

/** Desktop section links; the active one gets the yellow underline. */
export function HeaderNav() {
  const pathname = usePathname();

  return (
    <nav className="hidden gap-[22px] whitespace-nowrap text-[15px] font-bold text-[#46506a] lg:flex">
      {links.map(({ href, label }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "border-b-[3px] pb-1 pt-[7px] hover:text-foreground",
              active ? "border-sun text-foreground" : "border-transparent",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
