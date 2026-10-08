import type { Metadata } from "next";
import Link from "next/link";
import { Heart } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { buttonVariants } from "@/components/ui/button";
import { ListingCard } from "@/features/catalog/listing-card";
import { getMyFavorites } from "@/features/favorites/queries";

export const metadata: Metadata = { title: "Mis favoritos" };

export default async function FavoritesPage() {
  const user = await requireUser("/favorites");
  const favorites = await getMyFavorites(user.id);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-extrabold">Mis favoritos</h1>
      {favorites.length === 0 ? (
        <div className="rounded-[22px] border-[1.5px] border-dashed p-8 text-center">
          <Heart className="mx-auto size-8 text-pink-ink" aria-hidden />
          <p className="mt-2 font-bold">Aún no guardas productos</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Toca &quot;Guardar&quot; en un producto para encontrarlo aquí después.
          </p>
          <Link href="/search" className={buttonVariants({ className: "mt-4" })}>
            Explorar productos
          </Link>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {favorites.length} {favorites.length === 1 ? "producto guardado" : "productos guardados"}
          </p>
          <ul className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">
            {favorites.map((l) => (
              <li key={l.id}>
                <ListingCard listing={l} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
