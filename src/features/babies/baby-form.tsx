"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { saveBaby, type BabyFormState } from "./actions";
import { BABY_COLORS } from "./colors";

type Props = {
  today: string;
  baby?: {
    id: string;
    name: string;
    birth_date: string | null;
    due_date: string | null;
    color: keyof typeof BABY_COLORS;
  };
  onDone?: () => void;
};

export function BabyForm({ today, baby, onDone }: Props) {
  const [kind, setKind] = useState<"born" | "expecting">(baby?.due_date ? "expecting" : "born");
  const [color, setColor] = useState<keyof typeof BABY_COLORS>(baby?.color ?? "sky");
  const [state, action, pending] = useActionState<BabyFormState, FormData>(async (prev, data) => {
    const result = await saveBaby(prev, data);
    if (result?.ok) {
      // The "add" form is reused for the next baby: start it fresh.
      if (!baby) {
        setKind("born");
        setColor("sky");
      }
      onDone?.();
    }
    return result;
  }, undefined);

  return (
    <form action={action} className="space-y-4">
      {baby && <input type="hidden" name="id" value={baby.id} />}
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="color" value={color} />

      <div className="flex gap-2" role="radiogroup" aria-label="¿Ya nació?">
        {(
          [
            ["born", "Ya nació"],
            ["expecting", "Viene en camino"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={kind === value}
            onClick={() => setKind(value)}
            className={cn(
              "h-11 flex-1 rounded-full border-[1.5px] text-sm font-extrabold",
              kind === value ? "border-foreground bg-foreground text-white" : "bg-card hover:bg-muted",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`name-${baby?.id ?? "new"}`}>
          {kind === "born" ? "Nombre o apodo" : "Nombre o apodo (puede ser “Bebé”)"}
        </Label>
        <Input
          id={`name-${baby?.id ?? "new"}`}
          name="name"
          maxLength={40}
          required
          defaultValue={baby?.name}
          placeholder="Ej. Emilia"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`date-${baby?.id ?? "new"}`}>
          {kind === "born" ? "Fecha de nacimiento" : "Fecha probable de parto"}
        </Label>
        <Input
          id={`date-${baby?.id ?? "new"}`}
          name="date"
          type="date"
          required
          key={kind}
          max={kind === "born" ? today : undefined}
          min={kind === "expecting" ? today : undefined}
          defaultValue={(kind === "born" ? baby?.birth_date : baby?.due_date) ?? undefined}
        />
      </div>

      <div className="space-y-1.5">
        <p className="text-sm font-semibold">Color</p>
        <div className="flex gap-2">
          {(Object.keys(BABY_COLORS) as (keyof typeof BABY_COLORS)[]).map((c) => (
            <button
              key={c}
              type="button"
              aria-label={BABY_COLORS[c].label}
              aria-pressed={color === c}
              onClick={() => setColor(c)}
              className={cn(
                "size-10 rounded-full border-[3px]",
                BABY_COLORS[c].dot,
                color === c ? "border-foreground" : "border-transparent",
              )}
            />
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Solo tú ves esta información. La usamos para mostrarte productos de su etapa.
      </p>
      {state?.error && (
        <p role="alert" className="text-sm font-semibold text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? "Guardando…" : baby ? "Guardar cambios" : "Agregar bebé"}
      </Button>
    </form>
  );
}
