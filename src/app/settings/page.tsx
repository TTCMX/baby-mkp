import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "@/features/profile/profile-form";
import { signOut } from "@/features/auth/actions";
import Link from "next/link";
import { Package, ShoppingBag } from "lucide-react";
import { isStripeConfigured } from "@/lib/stripe";
import { PayoutsCard } from "@/features/payments/payouts-card";
import { syncPayoutStatus, type PayoutStatus } from "@/features/payments/payout-account";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "Mi cuenta" };

export default async function SettingsPage({ searchParams }: PageProps<"/settings">) {
  const user = await requireUser("/settings");
  const { payouts } = await searchParams;
  let payoutStatus: PayoutStatus | null = null;
  if (isStripeConfigured()) {
    try {
      payoutStatus = await syncPayoutStatus(user.id);
    } catch (err) {
      console.error("[settings] payout status failed", err);
    }
  }
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

      {payoutStatus && <PayoutsCard status={payoutStatus} error={payouts === "error"} />}

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
