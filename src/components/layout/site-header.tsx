import Link from "next/link";
import { Heart, Plus, Search, UserRound } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SITE_NAME } from "@/lib/site";

export async function SiteHeader() {
  const user = await getCurrentUser();

  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
        <Link href="/" className="shrink-0 text-lg font-extrabold leading-tight tracking-tight text-primary">
          <span className="hidden sm:inline">{SITE_NAME}</span>
          <span className="sm:hidden" aria-label={SITE_NAME}>
            BR
          </span>
        </Link>

        <form action="/search" className="relative flex-1" role="search">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            name="q"
            type="search"
            placeholder="Busca carriolas, ropa, marcas…"
            aria-label="Buscar productos"
            className="h-10 w-full rounded-full border border-input bg-card pl-10 pr-4 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30 md:text-sm"
          />
        </form>

        <nav className="hidden items-center gap-1 md:flex">
          <Link href="/sell/new" className={buttonVariants({ size: "sm" })}>
            <Plus /> Vender
          </Link>
          <Link
            href="/favorites"
            aria-label="Favoritos"
            className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
          >
            <Heart />
          </Link>
          <Link
            href={user ? "/settings" : "/login"}
            aria-label={user ? "Mi cuenta" : "Entrar"}
            className={cn(buttonVariants({ variant: "ghost", size: user ? "icon" : "sm" }))}
          >
            {user ? <UserRound /> : "Entrar"}
          </Link>
        </nav>
      </div>
    </header>
  );
}
