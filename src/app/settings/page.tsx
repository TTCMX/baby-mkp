import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "@/features/profile/profile-form";
import { signOut } from "@/features/auth/actions";
import Link from "next/link";
import { Baby, ChevronRight, Package, ShoppingBag, Wallet } from "lucide-react";
import { formatPrice } from "@/lib/money";
import { getMyBalance } from "@/features/wallet/queries";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "Mi cuenta" };

export default async function SettingsPage() {
  const user = await requireUser("/settings");
  const balance = await getMyBalance(user.id);
  const supabase = await createClient();
  const { data: privateProfile } = await supabase
    .from("private_profiles")
    .select("phone")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">Mi cuenta</h1>
        <p className="text-sm text-muted-foreground">{user.email}</p>
      </div>

      <Link
        href="/balance"
        id="saldo"
        className="flex items-center gap-3 rounded-2xl border bg-card p-4 hover:bg-muted"
      >
        <Wallet className="size-5 text-primary" />
        <span className="flex-1">
          <span className="block text-sm font-bold">Mi saldo</span>
          <span className="text-xs text-muted-foreground">Úsalo para comprar o retíralo a tu cuenta</span>
        </span>
        <span className="text-lg font-extrabold">{formatPrice(balance)}</span>
        <ChevronRight className="size-4 text-muted-foreground" />
      </Link>

      <Link href="/babies" className={buttonVariants({ variant: "outline", className: "w-full justify-start" })}>
        <Baby /> Mis bebés
      </Link>

      <div className="grid grid-cols-2 gap-2">
        <Link href="/orders" className={buttonVariants({ variant: "outline", className: "justify-start" })}>
          <ShoppingBag /> Mis pedidos
        </Link>
        <Link href="/sell" className={buttonVariants({ variant: "outline", className: "justify-start" })}>
          <Package /> Mis productos
        </Link>
      </div>

      {user.profile.role === "admin" && (
        <Link href="/admin" className={buttonVariants({ className: "w-full" })}>
          Panel de administración
        </Link>
      )}

      <Card className="p-5">
        <ProfileForm profile={user.profile} phone={privateProfile?.phone ?? null} />
      </Card>

      <form action={signOut}>
        <Button variant="outline" type="submit" className="w-full sm:w-auto">
          Cerrar sesión
        </Button>
      </form>
    </div>
  );
}
