import { AGE_STAGES, type AgeStage, type CategoryAgeMode } from "./constants";

/** Baby stages a recommended-age range can span, in order (pregnancy is not an item age). */
export const RANGE_STAGES = [
  "newborn",
  "0_3m",
  "3_6m",
  "6_12m",
  "1_2y",
  "2_4y",
  "4y_plus",
] as const satisfies AgeStage[];
export type RangeStage = (typeof RANGE_STAGES)[number];

export const isRangeStage = (s: AgeStage): s is RangeStage => (RANGE_STAGES as readonly string[]).includes(s);

/** Every stage from `from` to `to`, inclusive (order of the arguments doesn't matter). */
export function expandRange(from: RangeStage, to: RangeStage): RangeStage[] {
  const [a, b] = [RANGE_STAGES.indexOf(from), RANGE_STAGES.indexOf(to)].sort((x, y) => x - y);
  return RANGE_STAGES.slice(a, b + 1);
}

/** First and last stage of a selection, or null when it has none. */
export function rangeBounds(stages: AgeStage[]): { from: RangeStage; to: RangeStage } | null {
  const inRange = RANGE_STAGES.filter((s) => stages.includes(s));
  return inRange.length ? { from: inRange[0], to: inRange[inRange.length - 1] } : null;
}

/**
 * What gets stored for a listing in a category with this mode:
 * none → all ages; range → a contiguous run (or all ages); exact → the chosen stages.
 */
export function normalizeAgeStages(mode: CategoryAgeMode, stages: AgeStage[]): AgeStage[] {
  if (mode === "none" || (mode === "range" && stages.includes("all_ages"))) return ["all_ages"];
  if (mode === "range") {
    const bounds = rangeBounds(stages);
    return bounds ? expandRange(bounds.from, bounds.to) : [];
  }
  return [...new Set(stages.filter((s) => s !== "all_ages"))];
}

/** "De 6–12 meses a 2–4 años" for runs; single stages and all-ages keep their label. */
export function formatAgeRange(stages: AgeStage[]): string {
  if (stages.includes("all_ages")) return AGE_STAGES.all_ages;
  const bounds = rangeBounds(stages);
  if (!bounds) return stages.map((s) => AGE_STAGES[s]).join(", ");
  return bounds.from === bounds.to
    ? AGE_STAGES[bounds.from]
    : `De ${AGE_STAGES[bounds.from]} a ${AGE_STAGES[bounds.to]}`;
}
