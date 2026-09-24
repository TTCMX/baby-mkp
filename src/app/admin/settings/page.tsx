import { getPlatformSettings } from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";
import { CategoryForm, SettingsForm } from "@/features/admin/settings-forms";

export const metadata = { title: "Configuración" };

export default async function AdminSettings() {
  const settings = await getPlatformSettings();
  const supabase = await createClient(); // admin session: sees inactive categories too
  const { data: categories } = await supabase.from("categories").select("*").is("parent_id", null).order("sort_order");

  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-2xl border bg-card p-5">
        <h2 className="font-extrabold">Plataforma</h2>
        <SettingsForm s={settings} />
      </section>
      <section className="space-y-3 rounded-2xl border bg-card p-5">
        <h2 className="font-extrabold">Categorías</h2>
        <p className="text-xs text-muted-foreground">
          Íconos disponibles: baby, car, bed, milk, monitor, puzzle, shirt, footprints, backpack, bath, package.
          Desactivar una categoría la oculta del catálogo y del formulario de venta (sus productos siguen existiendo).
        </p>
        <ul className="space-y-4">
          {(categories ?? []).map((c) => (
            <li key={c.id} className="border-b pb-4">
              <CategoryForm c={c} />
            </li>
          ))}
          <li>
            <p className="mb-2 text-sm font-bold">Nueva categoría</p>
            <CategoryForm />
          </li>
        </ul>
      </section>
      <p className="text-xs text-muted-foreground">
        Las condiciones y etapas de edad son listas fijas del sistema; cambiarlas requiere una actualización de la app.
      </p>
    </div>
  );
}
