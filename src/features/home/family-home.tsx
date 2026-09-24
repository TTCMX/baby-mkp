"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { formatPrice } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { Baby, Family, TimelineStep } from "./demo-data";

/**
 * Home hero for families with one or more babies: a baby switcher over a size
 * timeline, "outgrown" and "next size" prompts, and a feed in the baby's size.
 * Feeds are rendered on the server and handed in per baby id.
 */
export function FamilyHome({
  family,
  feeds,
  nearHref,
}: {
  family: Family;
  feeds: Record<string, ReactNode>;
  nearHref: string;
}) {
  const [babyId, setBabyId] = useState(family.babies[0].id);
  const baby = family.babies.find((b) => b.id === babyId) ?? family.babies[0];

  return (
    <>
      <section
        aria-label={`Resumen de ${baby.name}`}
        className="flex flex-col gap-6 rounded-[32px] border-[1.5px] bg-card px-5 pb-7 pt-5 md:gap-7 md:px-10 md:pb-9 md:pt-7"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 border-b-[1.5px] border-[#eef2f7] pb-5">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="mr-1.5 text-sm font-extrabold text-pink-ink">Hola, {family.parentName}</span>
            {family.babies.map((b) => (
              <BabyTab key={b.id} baby={b} active={b.id === baby.id} onSelect={() => setBabyId(b.id)} />
            ))}
            <button
              type="button"
              className="flex h-12 items-center gap-2 rounded-full border-[1.5px] border-dashed border-[#c9d3e0] px-[18px] text-sm font-extrabold text-[#46506a] hover:bg-muted"
            >
              <Plus className="size-[18px]" aria-hidden />
              Agregar bebé
            </button>
          </div>
          <p className="flex shrink-0 items-baseline gap-2.5">
            <span className="text-[13px] font-bold text-muted-foreground">Crédito familiar</span>
            <span className="font-display text-[30px] font-bold">{formatPrice(family.creditCents)}</span>
          </p>
        </div>

        <div className="flex items-center gap-4 md:gap-[22px]">
          {/* eslint-disable-next-line @next/next/no-img-element -- static brand art, sized in CSS */}
          <img
            src="/brand/mascot.png"
            alt=""
            width={132}
            height={121}
            className="h-[73px] w-20 shrink-0 md:h-[121px] md:w-[132px]"
          />
          <h1 className="flex-1 text-pretty font-display text-[26px] font-bold leading-[1.1] md:text-[40px]">
            {baby.headline}
          </h1>
        </div>

        <div className="-mx-5 overflow-x-auto px-5 [scrollbar-width:none] md:mx-0 md:px-0">
          <ol className="grid min-w-[600px] grid-cols-6 gap-1.5">
            {baby.timeline.map((step) => (
              <TimelineItem key={step.label} step={step} />
            ))}
          </ol>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-4 rounded-[22px] bg-sun-wash px-6 py-[22px] sm:flex-row sm:items-center sm:gap-[18px]">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-[15px] font-extrabold text-[#7a5200]">Le queda chico · {baby.outgrown.size}</span>
              <span className="text-[15px] text-[#5b4a20]">{baby.outgrown.text}</span>
            </div>
            <div className="flex shrink-0 flex-col gap-2">
              <button
                type="button"
                className="flex h-11 items-center justify-center rounded-full bg-foreground px-5 font-extrabold text-white hover:bg-foreground/90"
              >
                Cambiar por {formatPrice(baby.outgrown.creditCents)}
              </button>
              {baby.outgrown.handDownTo && (
                <button
                  type="button"
                  className="flex h-10 items-center justify-center rounded-full border-[1.5px] border-[#ebd9a8] bg-card px-[18px] text-sm font-extrabold text-[#5b4a20] hover:bg-sun-wash"
                >
                  Guardar para {baby.outgrown.handDownTo}
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-4 rounded-[22px] bg-sky-wash px-6 py-[22px] sm:flex-row sm:items-center sm:gap-[18px]">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-[15px] font-extrabold text-secondary-foreground">
                Siguiente talla · {baby.next.size}
              </span>
              <span className="text-[15px] text-[#3a4a66]">{baby.next.text}</span>
            </div>
            <button
              type="button"
              className="flex h-11 shrink-0 items-center justify-center rounded-full bg-primary px-5 font-extrabold text-primary-foreground hover:bg-primary/90"
            >
              Activar aviso
            </button>
          </div>
        </div>
      </section>

      <section aria-labelledby="baby-feed-heading" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2
            id="baby-feed-heading"
            className="min-w-0 font-display text-[22px] sm:flex-1 font-semibold md:text-[26px]"
          >
            {baby.feedTitle}
          </h2>
          <div className="flex shrink-0 gap-2 whitespace-nowrap text-sm">
            <Link
              href={`/search?age=${baby.shopStages.join(",")}`}
              className="rounded-full bg-foreground px-4 py-2 font-extrabold text-white"
            >
              {baby.shopSize}
            </Link>
            <Link
              href="/search?q=oto%C3%B1o"
              className="rounded-full border-[1.5px] border-input bg-card px-4 py-2 font-bold hover:bg-muted"
            >
              Otoño
            </Link>
            <Link
              href={nearHref}
              className="rounded-full border-[1.5px] border-input bg-card px-4 py-2 font-bold hover:bg-muted"
            >
              Cerca de ti
            </Link>
          </div>
        </div>
        {feeds[baby.id]}
      </section>
    </>
  );
}

function BabyTab({ baby, active, onSelect }: { baby: Baby; active: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onSelect}
      className={cn(
        "flex h-12 items-center gap-2.5 rounded-full border-[1.5px] pl-1.5 pr-[18px] text-left",
        active ? "border-foreground bg-foreground text-white" : "border-input bg-card hover:bg-muted",
      )}
    >
      <span
        className="flex size-9 items-center justify-center rounded-full font-display text-base font-bold text-foreground"
        style={{ background: baby.color }}
        aria-hidden
      >
        {baby.name[0]}
      </span>
      <span className="flex flex-col leading-[1.1]">
        <span className="text-[15px] font-extrabold">{baby.name}</span>
        <span className="text-xs font-bold opacity-75">{baby.age}</span>
      </span>
    </button>
  );
}

const STEP_STYLES: Record<TimelineStep["state"], { bar: string; ink: string }> = {
  done: { bar: "bg-[#d5dce6]", ink: "text-[#8a93a8]" },
  resell: { bar: "bg-sun", ink: "text-foreground" },
  current: { bar: "", ink: "text-foreground" },
  next: { bar: "bg-pink-soft", ink: "text-foreground" },
  future: { bar: "bg-[#eef0f4]", ink: "text-[#8a93a8]" },
};

function TimelineItem({ step }: { step: TimelineStep }) {
  const style = STEP_STYLES[step.state];
  const progress = step.progress ?? 0;

  return (
    <li className="flex flex-col gap-2.5" aria-current={step.state === "current" ? "step" : undefined}>
      <div
        className={cn("h-3.5 rounded-full", style.bar)}
        style={
          step.state === "current"
            ? {
                background: `linear-gradient(90deg, var(--color-sky) ${progress}%, var(--color-sky-soft) ${progress}%)`,
              }
            : undefined
        }
      />
      <div className="flex flex-col gap-0.5">
        <span className={cn("font-display text-[17px] font-semibold", style.ink)}>{step.label}</span>
        <span className="text-[13px] font-bold text-muted-foreground">{step.note}</span>
      </div>
    </li>
  );
}
