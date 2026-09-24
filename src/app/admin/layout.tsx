import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { AdminNav } from "@/features/admin/admin-nav";

export const metadata = { title: { default: "Admin", template: "%s · Admin" } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Pages are protected here; every Server Action re-checks requireAdmin() itself.
  await requireAdmin();
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Link href="/admin" className="text-xl font-extrabold">
          Administración
        </Link>
      </div>
      <AdminNav />
      {children}
    </div>
  );
}
