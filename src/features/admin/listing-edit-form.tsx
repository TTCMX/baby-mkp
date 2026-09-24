"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LISTING_CONDITIONS, keysOf } from "@/lib/domain/constants";
import { updateListingAsAdmin, type AdminResult } from "./actions";

type Props = {
  id: string;
  title: string;
  description: string;
  priceCents: number;
  categoryId: string;
  condition: string;
  categories: { id: string; name: string }[];
};

export function ListingEditForm(p: Props) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<AdminResult>();
  const select = "h-11 w-full rounded-xl border border-input bg-card px-3 text-sm";

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        start(async () => setResult(await updateListingAsAdmin(p.id, data)));
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="title">Título</Label>
        <Input id="title" name="title" defaultValue={p.title} maxLength={90} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="price">Precio (MXN)</Label>
          <Input id="price" name="price" inputMode="decimal" defaultValue={p.priceCents / 100} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="condition">Condición</Label>
          <select id="condition" name="condition" defaultValue={p.condition} className={select}>
            {keysOf(LISTING_CONDITIONS).map((c) => (
              <option key={c} value={c}>
                {LISTING_CONDITIONS[c].label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="categoryId">Categoría</Label>
        <select id="categoryId" name="categoryId" defaultValue={p.categoryId} className={select}>
          {p.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="description">Descripción</Label>
        <Textarea id="description" name="description" defaultValue={p.description} rows={5} maxLength={4000} />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Guardando…" : "Guardar cambios"}
      </Button>
      {result?.error && <p className="text-sm font-semibold text-destructive">{result.error}</p>}
      {result?.ok && <p className="text-sm font-semibold text-accent-foreground">{result.ok}</p>}
    </form>
  );
}
