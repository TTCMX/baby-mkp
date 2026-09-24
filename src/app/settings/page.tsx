import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "@/features/profile/profile-form";
import { signOut } from "@/features/auth/actions";
import Link from "next/link";
import { Package } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "Mi cuenta" };

export default async function SettingsPage() {
  const user = await requireUser("/settings");
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

      <Link href="/sell" className={buttonVariants({ variant: "outline", className: "w-full justify-start" })}>
        <Package /> Mis productos
      </Link>

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
