"use client";

import { useState, useTransition } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { deleteBaby } from "./actions";
import { BabyForm } from "./baby-form";
import { BABY_COLORS } from "./colors";

export type BabyRow = {
  id: string;
  name: string;
  birth_date: string | null;
  due_date: string | null;
  color: keyof typeof BABY_COLORS;
  ageLabel: string;
  stageLabel: string;
};

export function BabyList({ babies, today }: { babies: BabyRow[]; today: string }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <ul className="space-y-3">
      {babies.map((b) => (
        <li key={b.id} className="rounded-[22px] border-[1.5px] bg-card p-4">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "flex size-11 shrink-0 items-center justify-center rounded-full font-display text-lg font-bold text-foreground",
                BABY_COLORS[b.color].dot,
              )}
            >
              {b.name.slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-extrabold">{b.name}</p>
              <p className="text-sm text-muted-foreground">
                {b.ageLabel} · {b.stageLabel}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Editar a ${b.name}`}
              onClick={() => setEditing(editing === b.id ? null : b.id)}
            >
              <Pencil />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Quitar a ${b.name}`}
              disabled={pending}
              onClick={() => {
                if (window.confirm(`¿Quitar a ${b.name}?`)) start(async () => void (await deleteBaby(b.id)));
              }}
            >
              <Trash2 />
            </Button>
          </div>
          {editing === b.id && (
            <div className="mt-4 border-t pt-4">
              <BabyForm today={today} baby={b} onDone={() => setEditing(null)} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
