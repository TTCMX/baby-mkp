import Link from "next/link";
import { getPlatformSettings } from "@/lib/settings";
import { getActiveCategories } from "@/features/listings/queries";
import { Importer } from "@/features/import/importer";

export const metadata = { title: "Importar productos" };

export default async function ImportPage() {
  const [categories, settings] = await Promise.all([getActiveCategories(), getPlatformSettings()]);
  return (
    <div className="space-y-4">
      <p className="text-sm">
        <Link href="/admin/managed" className="font-bold text-primary">
          ← Vendedores gestionados
        </Link>
      </p>
      <p className="text-sm text-muted-foreground">
        Crea un perfil público por vendedor (sin acceso a la cuenta: los operas desde aquí) y publica sus productos. Las
        fotos se descargan de sus enlaces y se optimizan; con miles de productos tarda: deja la pestaña abierta.
      </p>
      <Importer
        categories={categories.map(({ id, slug, name, age_mode, allows_shipping }) => ({
          id,
          slug,
          name,
          age_mode,
          allows_shipping,
        }))}
        maxPhotos={settings.max_images_per_listing}
      />
    </div>
  );
}
