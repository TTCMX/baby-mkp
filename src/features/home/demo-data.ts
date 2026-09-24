import type { AgeStage } from "@/lib/domain/constants";

/*
 * Demo data for the "Crece con tus bebés" home. Baby profiles, family credit,
 * restock alerts and bundles don't exist in the schema yet; these fixtures stand
 * in for them so the UI can ship first. Replace with real queries as each lands.
 */

/**
 * Where a size sits in a baby's life:
 * done (outgrown and sold) · resell (outgrown, still at home) · current ·
 * next (coming up soon) · future.
 */
export type TimelineState = "done" | "resell" | "current" | "next" | "future";

export type TimelineStep = {
  label: string;
  note: string;
  state: TimelineState;
  /** How far through the current size the baby is, 0–100. Only for `current`. */
  progress?: number;
};

export type Baby = {
  id: string;
  name: string;
  age: string;
  /** Avatar fill. */
  color: string;
  headline: string;
  timeline: TimelineStep[];
  /** Size label for the search chip, plus the catalogue stages its feed pulls from. */
  shopSize: string;
  shopStages: AgeStage[];
  outgrown: {
    size: string;
    creditCents: number;
    text: string;
    /** A younger sibling who'll wear this size later: offers "Guardar para …". */
    handDownTo?: string;
  };
  next: { size: string; text: string };
  feedTitle: string;
};

export type Family = {
  parentName: string;
  creditCents: number;
  babies: Baby[];
};

export const DEMO_FAMILY: Family = {
  parentName: "Mariana",
  creditCents: 34000,
  babies: [
    {
      id: "emilia",
      name: "Emilia",
      age: "7 meses",
      color: "#ffd6e3",
      headline: "Emilia tiene 7 meses. En unas semanas entra a 9–12 m.",
      timeline: [
        { label: "0–3 m", note: "vendido", state: "done" },
        { label: "3–6 m", note: "14 por revender", state: "resell" },
        { label: "6–12 m", note: "ahora · 7 meses", state: "current", progress: 22 },
        { label: "9–12 m", note: "en ~3 semanas", state: "next" },
        { label: "1–2 años", note: "¡Mateo guardó 9 prendas!", state: "future" },
        { label: "2–4 años", note: "", state: "future" },
      ],
      shopSize: "9–12 m",
      shopStages: ["6_12m"],
      outgrown: {
        size: "3–6 m",
        creditCents: 49000,
        text: "14 prendas que compraste aquí están listas para revender con un clic.",
      },
      next: { size: "9–12 m", text: "Te avisamos cuando lleguen lotes de su talla cerca de Coyoacán." },
      feedTitle: "Listo para la siguiente talla de Emilia",
    },
    {
      id: "mateo",
      name: "Mateo",
      age: "2 años 3 m",
      color: "#bfddf7",
      headline: "Mateo tiene 2 años y 3 meses. Va a la mitad de su talla 2–4 años.",
      timeline: [
        { label: "0–3 m", note: "vendido", state: "done" },
        { label: "3–6 m", note: "vendido", state: "done" },
        { label: "6–12 m", note: "vendido", state: "done" },
        { label: "1–2 años", note: "18 sin usar", state: "resell" },
        { label: "2–4 años", note: "ahora · 2 a 3 m", state: "current", progress: 55 },
        { label: "4+ años", note: "en ~1 año", state: "next" },
      ],
      shopSize: "2–4 años",
      shopStages: ["2_4y"],
      outgrown: {
        size: "1–2 años",
        creditCents: 62000,
        text: "18 prendas de 1–2 años. Emilia llega a esa talla en ~5 meses: véndelas o guárdalas para ella.",
        handDownTo: "Emilia",
      },
      next: {
        size: "4+ años",
        text: "Aún falta. Mientras, te mostramos básicos de 2–4 años para completar su armario.",
      },
      feedTitle: "Para completar el armario de Mateo",
    },
  ],
};

export type Bundle = {
  id: string;
  title: string;
  size: string;
  count: number;
  priceCents: number;
  savePercent: number;
  /** Front and back photo of the stacked thumbnail. */
  images: [string, string];
  /** Card fill and back-photo fill. */
  tint: "sky" | "pink" | "sun";
};

const unsplash = (id: string) => `https://images.unsplash.com/photo-${id}?w=300&q=70&auto=format&fit=crop`;

export const DEMO_BUNDLES: Bundle[] = [
  {
    id: "basicos-recien-nacido",
    title: "Básicos recién nacido",
    size: "0–3 m",
    count: 12,
    priceCents: 48000,
    savePercent: 55,
    images: [unsplash("1622290291165-d341f1938b8a"), unsplash("1622290319146-7b63df48a635")],
    tint: "sky",
  },
  {
    id: "otono-neutro",
    title: "Lote otoño neutro",
    size: "6–12 m",
    count: 8,
    priceCents: 62000,
    savePercent: 47,
    images: [unsplash("1622218286192-95f6a20083c7"), unsplash("1556905055-8f358a7a47b2")],
    tint: "pink",
  },
  {
    id: "guarderia",
    title: "Para la guardería",
    size: "1–2 años",
    count: 10,
    priceCents: 54000,
    savePercent: 56,
    images: [unsplash("1560506840-ec148e82a604"), unsplash("1684244160171-97f5dac39204")],
    tint: "sun",
  },
];
