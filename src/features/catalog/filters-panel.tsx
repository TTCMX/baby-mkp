"use client";

import Link from "next/link";
import { createContext, use, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AGE_STAGES, DELIVERY_METHODS, LISTING_CONDITIONS, keysOf } from "@/lib/domain/constants";
import { cn } from "@/lib/utils";
import type { CatalogFilters } from "./filters";

type Props = {
  filters: CatalogFilters;
  basePath: string;
  categories: { slug: string; name: string }[] | null;
};

const FiltersOpen = createContext<[boolean, (open: boolean) => void]>([false, () => {}]);

/** Shares the "sheet open" state between the mobile button and the panel. */
export function FiltersProvider({ children }: { children: React.ReactNode }) {
  const state = useState(false);
  return <FiltersOpen value={state}>{children}</FiltersOpen>;
}

/** Opens the filters sheet (phones only; desktop shows the sidebar). */
export function FiltersButton({ activeCount }: { activeCount: number }) {
  const [, setOpen] = use(FiltersOpen);
  return (
    <Button type="button" variant="outline" size="sm" className="md:hidden" onClick={() => setOpen(true)}>
      <SlidersHorizontal /> Filtros
      {activeCount > 0 && (
        <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[11px] text-primary-foreground">
          {activeCount}
        </span>
      )}
    </Button>
  );
}

/**
 * Plain GET form: submitting navigates to `basePath?...`, so filters are
 * server-rendered and shareable. Sidebar on desktop, full-screen sheet on phones.
 */
export function FiltersPanel({ filters, basePath, categories }: Props) {
  const [open, setOpen] = use(FiltersOpen);

  return (
    <aside
      className={cn(
        open ? "fixed inset-0 z-50 overflow-y-auto bg-background px-4 pb-28 pt-4" : "hidden",
        "md:static md:z-auto md:block md:overflow-visible md:bg-transparent md:p-0",
      )}
      aria-label="Filtros"
    >
      <div className="mb-4 flex items-center justify-between md:hidden">
        <h2 className="text-lg font-extrabold">Filtros</h2>
        <Button type="button" variant="ghost" size="icon" aria-label="Cerrar filtros" onClick={() => setOpen(false)}>
          <X />
        </Button>
      </div>

      <form
        action={basePath}
        className="space-y-6"
        onSubmit={(e) => {
          // Keep URLs clean: don't send empty fields (?min=&brand=…). The form data is
          // captured synchronously, so re-enable them right after (back button restores them).
          const empty = Array.from(e.currentTarget.elements).filter(
            (el): el is HTMLInputElement | HTMLSelectElement =>
              (el instanceof HTMLInputElement || el instanceof HTMLSelectElement) && !!el.name && !el.value,
          );
          empty.forEach((el) => (el.disabled = true));
          setTimeout(() => empty.forEach((el) => (el.disabled = false)));
          setOpen(false);
        }}
      >
        {filters.q && <input type="hidden" name="q" value={filters.q} />}
        {filters.sort !== "recent" && <input type="hidden" name="sort" value={filters.sort} />}

        {categories && (
          <Group title="Categoría">
            <select
              name="category"
              defaultValue={filters.category ?? ""}
              className="h-11 w-full rounded-xl border border-input bg-card px-3 text-base md:text-sm"
            >
              <option value="">Todas</option>
              {categories.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </Group>
        )}

        <Group title="Precio (MXN)">
          <div className="grid grid-cols-2 gap-2">
            <Input
              name="min"
              inputMode="decimal"
              placeholder="Mín."
              aria-label="Precio mínimo"
              defaultValue={filters.minPriceCents ? filters.minPriceCents / 100 : ""}
            />
            <Input
              name="max"
              inputMode="decimal"
              placeholder="Máx."
              aria-label="Precio máximo"
              defaultValue={filters.maxPriceCents ? filters.maxPriceCents / 100 : ""}
            />
          </div>
        </Group>

        <Group title="Edad o etapa">
          <div className="flex flex-wrap gap-2">
            {keysOf(AGE_STAGES).map((a) => (
              <CheckPill key={a} name="age" value={a} defaultChecked={filters.ages.includes(a)}>
                {AGE_STAGES[a]}
              </CheckPill>
            ))}
          </div>
        </Group>

        <Group title="Condición">
          <div className="flex flex-wrap gap-2">
            {keysOf(LISTING_CONDITIONS).map((c) => (
              <CheckPill key={c} name="condition" value={c} defaultChecked={filters.conditions.includes(c)}>
                {LISTING_CONDITIONS[c].label}
              </CheckPill>
            ))}
          </div>
        </Group>

        <Group title="Marca">
          <Input name="brand" placeholder="Ej. Nuna" defaultValue={filters.brand} maxLength={60} />
        </Group>

        <Group title="Ubicación">
          <Input name="city" placeholder="Ciudad o alcaldía" defaultValue={filters.city} maxLength={80} />
        </Group>

        <Group title="Entrega">
          <div className="flex flex-wrap gap-2">
            {keysOf(DELIVERY_METHODS).map((d) => (
              <CheckPill key={d} name="delivery" value={d} defaultChecked={filters.delivery.includes(d)}>
                {DELIVERY_METHODS[d]}
              </CheckPill>
            ))}
          </div>
        </Group>

        <div className="fixed inset-x-0 bottom-0 flex gap-2 border-t bg-background p-4 md:static md:border-0 md:bg-transparent md:p-0">
          <Link
            href={basePath + (filters.q ? `?q=${encodeURIComponent(filters.q)}` : "")}
            className={buttonVariants({ variant: "outline", className: "flex-1" })}
            onClick={() => setOpen(false)}
          >
            Limpiar
          </Link>
          <Button type="submit" className="flex-1">
            Ver resultados
          </Button>
        </div>
      </form>
    </aside>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-sm font-bold">{title}</legend>
      {children}
    </fieldset>
  );
}

function CheckPill({ children, ...props }: React.ComponentProps<"input">) {
  return (
    <Label className="cursor-pointer">
      <input type="checkbox" className="peer sr-only" {...props} />
      <span className="inline-block rounded-full border bg-card px-3 py-1.5 text-sm font-semibold transition-colors peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/40">
        {children}
      </span>
    </Label>
  );
}
