import { AGE_STAGES, type AgeStage } from "@/lib/domain/constants";

// Pure stage math for "Crece con tus bebés". Dates are calendar days
// (YYYY-MM-DD) in Mexico City time; `today` is always passed in so the
// logic is deterministic and testable.

export type BabyDates = { birth_date: string | null; due_date: string | null };

/** Life stages in order, with their range in months since birth. */
export const STAGE_ORDER: { stage: AgeStage; from: number; to: number | null }[] = [
  { stage: "pregnancy", from: -9, to: 0 },
  { stage: "0_3m", from: 0, to: 3 },
  { stage: "3_6m", from: 3, to: 6 },
  { stage: "6_12m", from: 6, to: 12 },
  { stage: "1_2y", from: 12, to: 24 },
  { stage: "2_4y", from: 24, to: 48 },
  { stage: "4y_plus", from: 48, to: null },
];

const PREGNANCY_DAYS = 280;

function toUtcDay(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
}

export function daysBetween(from: string, to: string) {
  return Math.round(toUtcDay(to) - toUtcDay(from));
}

/** Today's date in Mexico City as YYYY-MM-DD. */
export function todayInMexico(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(now);
}

/** Calendar date `n` months after `iso` (day clamped to the month's length). */
export function addMonths(iso: string, n: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  const year = Math.floor(total / 12);
  const month = total % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(Math.min(d, lastDay)).padStart(2, "0")}`;
}

/** Whole calendar months since `from` (a birthday counts on the same day of the month). */
export function completedMonths(from: string, today: string) {
  const [y1, m1, d1] = from.split("-").map(Number);
  const [y2, m2, d2] = today.split("-").map(Number);
  let months = (y2 - y1) * 12 + (m2 - m1);
  if (d2 < d1 && addMonths(from, months) > today) months -= 1;
  return Math.max(0, months);
}

/** Date the baby was (or is expected to be) born. */
function birthOf(b: BabyDates) {
  return (b.birth_date ?? b.due_date)!;
}

export function isPregnancy(b: BabyDates, today: string) {
  return !b.birth_date && daysBetween(today, b.due_date!) > 0;
}

export function currentStageIndex(b: BabyDates, today: string) {
  if (isPregnancy(b, today)) return 0;
  const months = completedMonths(birthOf(b), today);
  const i = STAGE_ORDER.findIndex(
    (s) => s.stage !== "pregnancy" && months >= s.from && (s.to === null || months < s.to),
  );
  return i === -1 ? STAGE_ORDER.length - 1 : i;
}

export function currentStage(b: BabyDates, today: string): AgeStage {
  return STAGE_ORDER[currentStageIndex(b, today)].stage;
}

export type TimelineState = "done" | "current" | "next" | "future";
export type TimelineStep = { stage: AgeStage; label: string; state: TimelineState; progress?: number };

/** Every stage with where the baby is; `progress` (0–100) through the current one. */
export function timeline(b: BabyDates, today: string): TimelineStep[] {
  const current = currentStageIndex(b, today);
  return STAGE_ORDER.map(({ stage, from, to }, i) => {
    const state: TimelineState =
      i < current ? "done" : i === current ? "current" : i === current + 1 ? "next" : "future";
    const step: TimelineStep = { stage, label: AGE_STAGES[stage], state };
    if (state === "current") {
      if (stage === "pregnancy") {
        const elapsed = PREGNANCY_DAYS - daysBetween(today, b.due_date!);
        step.progress = clamp(Math.round((elapsed / PREGNANCY_DAYS) * 100));
      } else if (to !== null) {
        const start = addMonths(birthOf(b), from);
        const end = addMonths(birthOf(b), to);
        step.progress = clamp(Math.round((daysBetween(start, today) / daysBetween(start, end)) * 100));
      }
    }
    return step;
  });
}

/** The stage just outgrown (none for newborns, pregnancies and the first stage after birth). */
export function outgrownStage(b: BabyDates, today: string): AgeStage | null {
  const i = currentStageIndex(b, today);
  return i >= 2 ? STAGE_ORDER[i - 1].stage : null;
}

export function nextStage(b: BabyDates, today: string): AgeStage | null {
  const i = currentStageIndex(b, today);
  return i < STAGE_ORDER.length - 1 ? STAGE_ORDER[i + 1].stage : null;
}

/** Days until the baby enters the next stage (null when there's none). */
export function daysUntilNextStage(b: BabyDates, today: string): number | null {
  if (isPregnancy(b, today)) return daysBetween(today, b.due_date!);
  const i = currentStageIndex(b, today);
  const to = STAGE_ORDER[i].to;
  if (to === null) return null;
  return Math.max(0, daysBetween(today, addMonths(birthOf(b), to)));
}

/** "7 meses", "1 año y 3 meses", "3 años", "Semana 27 de embarazo". */
export function ageLabel(b: BabyDates, today: string) {
  if (isPregnancy(b, today)) {
    const week = Math.max(1, Math.floor((PREGNANCY_DAYS - daysBetween(today, b.due_date!)) / 7));
    return `Semana ${Math.min(week, 42)} de embarazo`;
  }
  const days = daysBetween(birthOf(b), today);
  const months = completedMonths(birthOf(b), today);
  if (months < 1) return days <= 1 ? "Recién nacido" : `${days} días`;
  if (months < 12) return `${months} ${months === 1 ? "mes" : "meses"}`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const y = `${years} ${years === 1 ? "año" : "años"}`;
  return years >= 4 || rest === 0 ? y : `${y} y ${rest} ${rest === 1 ? "mes" : "meses"}`;
}

/** Friendly headline for the home hero. */
export function headline(name: string, b: BabyDates, today: string) {
  const stage = currentStage(b, today);
  const next = nextStage(b, today);
  const days = daysUntilNextStage(b, today);
  if (stage === "pregnancy") {
    return days !== null && days <= 60
      ? `¡Ya casi llega ${name}! Prepárate para sus primeros meses`
      : `Preparando todo para ${name}`;
  }
  if (next && days !== null && days <= 30) {
    const when = days <= 7 ? "esta semana" : `en ${Math.ceil(days / 7)} semanas`;
    return `${name} pasa a ${AGE_STAGES[next]} ${when}`;
  }
  return `${name} está en ${AGE_STAGES[stage]}`;
}

function clamp(n: number) {
  return Math.min(100, Math.max(0, n));
}
