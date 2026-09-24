import {
  AGE_STAGES,
  DELIVERY_METHODS,
  LISTING_CONDITIONS,
  type AgeStage,
  type DeliveryMethod,
  type ListingCondition,
} from "@/lib/domain/constants";
import { parsePriceToCents } from "@/lib/money";

// Catalogue filters live in the URL (shareable, back-button friendly, SSR).

export const SORTS = {
  recent: "Más recientes",
  price_asc: "Precio: menor a mayor",
  price_desc: "Precio: mayor a menor",
  popular: "Más populares",
} as const;
export type Sort = keyof typeof SORTS;

export type CatalogFilters = {
  q: string;
  category: string | null;
  minPriceCents: number | null;
  maxPriceCents: number | null;
  brand: string;
  conditions: ListingCondition[];
  ages: AgeStage[];
  city: string;
  delivery: DeliveryMethod[];
  sort: Sort;
  page: number;
};

type RawParams = Record<string, string | string[] | undefined>;

const list = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? v.split(",") : []);
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const pick = <T extends string>(values: string[], allowed: Record<T, unknown>) =>
  [...new Set(values)].filter((v): v is T => v in allowed);
// Free text used inside PostgREST filters: keep letters, digits, spaces and a few symbols.
export const cleanText = (v: string, max: number) =>
  v
    .normalize("NFC")
    .replace(/[^\p{L}\p{N}\s'&.-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

export function parseFilters(params: RawParams): CatalogFilters {
  const price = (v: string) => {
    const cents = v ? parsePriceToCents(v) : null;
    return cents && cents > 0 ? cents : null;
  };
  const sort = one(params.sort);
  const page = Number.parseInt(one(params.page), 10);
  const category = one(params.category);

  let minPriceCents = price(one(params.min));
  let maxPriceCents = price(one(params.max));
  if (minPriceCents && maxPriceCents && minPriceCents > maxPriceCents) {
    [minPriceCents, maxPriceCents] = [maxPriceCents, minPriceCents];
  }

  return {
    q: cleanText(one(params.q), 80),
    category: /^[a-z0-9-]{2,60}$/.test(category) ? category : null,
    minPriceCents,
    maxPriceCents,
    brand: cleanText(one(params.brand), 60),
    conditions: pick(list(params.condition), LISTING_CONDITIONS),
    ages: pick(list(params.age), AGE_STAGES),
    city: cleanText(one(params.city), 80),
    delivery: pick(list(params.delivery), DELIVERY_METHODS),
    sort: sort in SORTS ? (sort as Sort) : "recent",
    page: Number.isFinite(page) && page > 0 ? Math.min(page, 100) : 1,
  };
}

/** Serialises filters back to a query string (omits defaults). */
export function filtersToQuery(f: Partial<CatalogFilters>): string {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.category) p.set("category", f.category);
  if (f.minPriceCents) p.set("min", String(f.minPriceCents / 100));
  if (f.maxPriceCents) p.set("max", String(f.maxPriceCents / 100));
  if (f.brand) p.set("brand", f.brand);
  if (f.conditions?.length) p.set("condition", f.conditions.join(","));
  if (f.ages?.length) p.set("age", f.ages.join(","));
  if (f.city) p.set("city", f.city);
  if (f.delivery?.length) p.set("delivery", f.delivery.join(","));
  if (f.sort && f.sort !== "recent") p.set("sort", f.sort);
  if (f.page && f.page > 1) p.set("page", String(f.page));
  const s = p.toString();
  return s ? `?${s}` : "";
}

/**
 * Full-text query with prefix matching so partial words work while typing:
 * "carri nuna" → "carri:* & nuna:*". Returns null when nothing searchable remains.
 */
export function toTsQuery(q: string): string | null {
  const terms = q
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .slice(0, 8);
  return terms.length ? terms.map((t) => `${t}:*`).join(" & ") : null;
}

const CITY_ALIASES: Record<string, string> = {
  cdmx: "ciudad de mexico",
  df: "ciudad de mexico",
  "d f": "ciudad de mexico",
  "mexico city": "ciudad de mexico",
  gdl: "guadalajara",
  mty: "monterrey",
};

/** Matches `listings.location_text`: lower-case, no accents, common aliases expanded. */
export function normalizeLocation(v: string): string {
  const plain = v
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return CITY_ALIASES[plain] ?? plain;
}

/** Filters (other than q/sort/page) currently applied — for chips and analytics. */
export function activeFilterKeys(f: CatalogFilters): string[] {
  const keys: string[] = [];
  if (f.category) keys.push("category");
  if (f.minPriceCents || f.maxPriceCents) keys.push("price");
  if (f.brand) keys.push("brand");
  if (f.conditions.length) keys.push("condition");
  if (f.ages.length) keys.push("age");
  if (f.city) keys.push("city");
  if (f.delivery.length) keys.push("delivery");
  return keys;
}
