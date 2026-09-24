import Link from "next/link";
import { Bell, Heart, Plus, Search, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SITE_NAME } from "@/lib/site";
import { HeaderNav } from "./header-nav";

export async function SiteHeader() {
  const user = await getCurrentUser();
  let unread = 0;
  if (user) {
    const supabase = await createClient();
    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("read_at", null);
    unread = count ?? 0;
  }

  return (
    <header className="sticky top-0 z-40 border-b bg-card/90 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 md:h-[76px] md:gap-6">
        <Link href="/" aria-label={SITE_NAME} className="shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element -- static brand art, sized in CSS */}
          <img src="/brand/wordmark.png" alt="" width={219} height={36} className="hidden h-9 w-[219px] sm:block" />
          {/* eslint-disable-next-line @next/next/no-img-element -- static brand art, sized in CSS */}
          <img src="/brand/mascot.png" alt="" width={44} height={40} className="h-10 w-11 sm:hidden" />
        </Link>

        <HeaderNav />

        <form action="/search" className="relative flex-1" role="search">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 md:left-4 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            name="q"
            type="search"
            placeholder="Busca ropa, tallas, marcas…"
            aria-label="Buscar productos"
            className="h-10 w-full rounded-full border border-transparent bg-muted pl-10 pr-4 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30 md:h-11 md:pl-11 md:text-[15px]"
          />
        </form>

        {user && (
          <Link
            href="/notifications"
            aria-label={unread ? `Avisos (${unread} nuevos)` : "Avisos"}
            className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "relative shrink-0")}
          >
            <Bell />
            {unread > 0 && (
              <span className="absolute right-1 top-1 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Link>
        )}

        <nav className="hidden items-center gap-1 md:flex">
          {user?.profile.role === "admin" && (
            <Link href="/admin" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              Admin
            </Link>
          )}
          <Link
            href="/sell/new"
            className={cn(
              buttonVariants(),
              "h-11 bg-pink px-[22px] text-[15px] font-extrabold text-foreground hover:bg-pink/90",
            )}
          >
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
