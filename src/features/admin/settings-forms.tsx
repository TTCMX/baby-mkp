"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveCategory, updatePlatformSettings, type AdminResult } from "./actions";

function Message({ state }: { state?: AdminResult }) {
  if (state?.error) return <p className="text-sm font-semibold text-destructive">{state.error}</p>;
  if (state?.ok) return <p className="text-sm font-semibold text-accent-foreground">{state.ok}</p>;
  return null;
}

type Settings = {
  platform_commission_percentage: number;
  concierge_commission_percentage: number;
  concierge_min_price_cents: number;
  max_images_per_listing: number;
  order_auto_complete_days: number;
  listings_require_review: boolean;
};

export function SettingsForm({ s }: { s: Settings }) {
  const [state, action, pending] = useActionState(updatePlatformSettings, undefined);
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Comisión de la plataforma (%)"
          name="platform_commission_percentage"
          value={s.platform_commission_percentage}
          step="0.1"
        />
        <Field
          label="Comisión concierge (%)"
          name="concierge_commission_percentage"
          value={s.concierge_commission_percentage}
          step="0.1"
        />
        <Field
          label="Umbral concierge (MXN)"
          name="concierge_min_price"
          value={s.concierge_min_price_cents / 100}
          step="1"
        />
        <Field
          label="Máximo de fotos por producto"
          name="max_images_per_listing"
          value={s.max_images_per_listing}
          step="1"
        />
        <Field
          label="Días para completar tras 'entregado'"
          name="order_auto_complete_days"
          value={s.order_auto_complete_days}
          step="1"
        />
      </div>
      <label className="flex items-center gap-3 text-sm font-semibold">
        <input
          type="checkbox"
          name="listings_require_review"
          value="on"
          defaultChecked={s.listings_require_review}
          className="size-5"
        />
        Revisar productos antes de publicarlos
      </label>
      <p className="text-xs text-muted-foreground">
        Los cambios de comisión aplican a compras nuevas; cada pedido guarda la comisión con la que se pagó.
      </p>
      <Button type="submit" disabled={pending}>
        Guardar configuración
      </Button>
      <Message state={state} />
    </form>
  );
}

function Field({ label, name, value, step }: { label: string; name: string; value: number; step: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type="number" min="0" step={step} defaultValue={value} required />
    </div>
  );
}

type Category = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
  allows_shipping: boolean;
};

export function CategoryForm({ c }: { c?: Category }) {
  const [state, action, pending] = useActionState(saveCategory, undefined);
  return (
    <form action={action} className="grid gap-2 sm:grid-cols-[1fr_1fr_7rem_5rem_auto] sm:items-end">
      <input type="hidden" name="id" value={c?.id ?? ""} />
      <div className="space-y-1">
        <Label className="text-xs">Nombre</Label>
        <Input name="name" defaultValue={c?.name} required maxLength={60} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Slug (URL)</Label>
        <Input name="slug" defaultValue={c?.slug} required pattern="[a-z0-9-]{2,60}" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Ícono</Label>
        <Input name="icon" defaultValue={c?.icon ?? ""} placeholder="baby" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Orden</Label>
        <Input name="sort_order" type="number" defaultValue={c?.sort_order ?? 100} />
      </div>
      <div className="flex flex-wrap items-center gap-3 text-xs sm:pb-2">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" name="is_active" value="on" defaultChecked={c?.is_active ?? true} /> Activa
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" name="allows_shipping" value="on" defaultChecked={c?.allows_shipping ?? true} />{" "}
          Permite envío
        </label>
        <Button type="submit" size="sm" disabled={pending}>
          {c ? "Guardar" : "Crear"}
        </Button>
      </div>
      <div className="sm:col-span-5">
        <Message state={state} />
      </div>
    </form>
  );
}
