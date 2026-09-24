"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Check, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { BABY_COLORS } from "./colors";
import type { TimelineStep } from "./stages";

export type BabyView = {
  id: string;
  name: string;
  color: keyof typeof BABY_COLORS;
  ageLabel: string;
  headline: string;
  timeline: TimelineStep[];
  currentStage: string;
  currentLabel: string;
  outgrown: { stage: string; label: string } | null;
  next: { stage: string; label: string; days: number | null } | null;
};

/**
 * "Crece con tus bebés": switch between babies, see where each one is in its
 * stages, and act on it (sell what's outgrown, shop the next stage).
 * Feeds are rendered on the server, one per baby id.
 */
export function FamilyHome({
  parentName,
  babies,
  feeds,
}: {
  parentName: string;
  babies: BabyView[];
  feeds: Record<string, ReactNode>;
}) {
  const [babyId, setBabyId] = useState(babies[0].id);
  const baby = babies.find((b) => b.id === babyId) ?? babies[0];
  const track = useRef<HTMLDivElement>(null);

  // On phones the timeline scrolls sideways: bring the current stage into view.
  useEffect(() => {
    const el = track.current;
    const current = el?.querySelector<HTMLElement>('[aria-current="step"]');
    if (el && current) el.scrollLeft = current.offsetLeft - el.clientWidth / 2 + current.clientWidth / 2;
  }, [babyId]);

  return (
    <>
      <section
        aria-label={`Resumen de ${baby.name}`}
        className="flex flex-col gap-6 rounded-[32px] border-[1.5px] bg-card px-5 pb-7 pt-5 md:gap-7 md:px-10 md:pb-9 md:pt-7"
      >
        <div className="flex flex-wrap items-center gap-2.5 border-b-[1.5px] border-[#eef2f7] pb-5">
          <span className="mr-1.5 text-sm font-extrabold text-pink-ink">Hola, {parentName}</span>
          {babies.map((b) => (
            <button
              key={b.id}
              type="button"
              aria-pressed={b.id === baby.id}
              onClick={() => setBabyId(b.id)}
              className={cn(
                "flex h-12 items-center gap-2.5 rounded-full border-[1.5px] pl-1.5 pr-[18px] text-left",
                b.id === baby.id ? "border-foreground bg-foreground text-white" : "border-input bg-card hover:bg-muted",
              )}
            >
              <span
                className={cn(
                  "flex size-9 items-center justify-center rounded-full font-display font-bold text-foreground",
                  BABY_COLORS[b.color].dot,
                )}
              >
                {b.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="flex flex-col leading-tight">
                <span className="text-sm font-extrabold">{b.name}</span>
                <span className={cn("text-xs", b.id === baby.id ? "text-white/75" : "text-muted-foreground")}>
                  {b.ageLabel}
                </span>
              </span>
            </button>
          ))}
          <Link
            href="/babies"
            className="flex h-12 items-center gap-2 rounded-full border-[1.5px] border-dashed border-[#c9d3e0] px-[18px] text-sm font-extrabold text-[#46506a] hover:bg-muted"
          >
            <Plus className="size-[18px]" aria-hidden />
            {babies.length < 8 ? "Agregar bebé" : "Editar"}
          </Link>
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
          <h1 className="flex-1 text-pretty text-[26px] font-bold leading-[1.1] md:text-[40px]">
            {noBreakRanges(baby.headline)}
          </h1>
        </div>

        <div ref={track} className="relative -mx-5 overflow-x-auto px-5 [scrollbar-width:none] md:mx-0 md:px-0">
          <ol className="grid min-w-[720px] grid-cols-8 gap-1.5" aria-label="Etapas">
            {baby.timeline.map((step) => (
              <TimelineItem key={step.stage} step={step} />
            ))}
          </ol>
        </div>

        <div className={cn("grid gap-4", baby.outgrown && baby.next && "md:grid-cols-2")}>
          {baby.outgrown && (
            <div className="flex flex-col gap-4 rounded-[22px] bg-sun-wash px-6 py-[22px] sm:flex-row sm:items-center sm:gap-[18px]">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-[15px] font-extrabold text-[#7a5200]">
                  Le queda chico · {baby.outgrown.label}
                </span>
                <span className="text-[15px] text-[#5b4a20]">
                  Lo que {baby.name} usaba en {baby.outgrown.label} puede servirle a otra familia. Véndelo en un par de
                  minutos.
                </span>
              </div>
              <Link
                href={`/sell/new?age=${baby.outgrown.stage}`}
                className="flex h-11 shrink-0 items-center justify-center rounded-full bg-foreground px-5 font-extrabold text-white hover:bg-foreground/90"
              >
                Vender lo de {baby.outgrown.label}
              </Link>
            </div>
          )}
          {baby.next && (
            <div className="flex flex-col gap-4 rounded-[22px] bg-sky-wash px-6 py-[22px] sm:flex-row sm:items-center sm:gap-[18px]">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-[15px] font-extrabold text-secondary-foreground">
                  Siguiente etapa · {baby.next.label}
                </span>
                <span className="text-[15px] text-[#3a4a66]">
                  {baby.next.days !== null && baby.next.days <= 45
                    ? `${baby.name} llega a ${baby.next.label} en ${baby.next.days} ${baby.next.days === 1 ? "día" : "días"}. Adelántate con buen precio.`
                    : `Cuando llegue el momento, aquí encontrarás lo que ${baby.name} va a necesitar.`}
                </span>
              </div>
              <Link
                href={`/search?age=${baby.next.stage}`}
                className="flex h-11 shrink-0 items-center justify-center rounded-full bg-primary px-5 font-extrabold text-primary-foreground hover:bg-primary/90"
              >
                Ver {baby.next.label}
              </Link>
            </div>
          )}
        </div>
      </section>

      <section aria-labelledby="baby-feed-heading" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 id="baby-feed-heading" className="min-w-0 text-[22px] font-semibold sm:flex-1 md:text-[26px]">
            Para {baby.name} · {baby.currentLabel}
          </h2>
          <Link
            href={`/search?age=${baby.currentStage}`}
            className="shrink-0 rounded-full bg-foreground px-4 py-2 text-sm font-extrabold text-white"
          >
            Ver todo
          </Link>
        </div>
        {feeds[baby.id]}
      </section>
    </>
  );
}

/** Keep ranges like "6–12" on one line (word joiners around the en dash). */
function noBreakRanges(text: string) {
  return text.replace(/(\d)–(\d)/g, "$1\u2060–\u2060$2");
}

const STEP_STYLES = {
  done: "bg-muted text-muted-foreground",
  current: "bg-foreground text-white",
  next: "border-[1.5px] border-dashed border-sky bg-sky-wash text-secondary-foreground",
  future: "border-[1.5px] border-[#eef2f7] bg-card text-muted-foreground",
} as const;

const STEP_NOTES = { done: "Ya pasó", current: "Ahora", next: "Sigue", future: "Más adelante" } as const;

function TimelineItem({ step }: { step: TimelineStep }) {
  return (
    <li
      aria-current={step.state === "current" ? "step" : undefined}
      className={cn(
        "flex min-h-[86px] flex-col justify-between gap-2 rounded-2xl px-3 py-2.5",
        STEP_STYLES[step.state],
      )}
    >
      <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide opacity-80">
        {step.state === "done" && <Check className="size-3" aria-hidden />}
        {STEP_NOTES[step.state]}
      </span>
      <span className="font-display text-[15px] font-semibold leading-tight">{step.label}</span>
      {step.state === "current" && step.progress !== undefined && (
        <span className="h-1.5 overflow-hidden rounded-full bg-white/25" aria-label={`${step.progress}% de la etapa`}>
          <span className="block h-full rounded-full bg-sun" style={{ width: `${step.progress}%` }} />
        </span>
      )}
    </li>
  );
}
