// Stable vocabularies mirrored from the database enums (supabase/migrations).
// Keep keys in sync with the SQL enums; labels are UI-only.

export const LISTING_CONDITIONS = {
  new_with_tags: { label: "Nuevo con etiquetas", hint: "Sin usar, con etiquetas o empaque original" },
  like_new: { label: "Como nuevo", hint: "Usado muy poco, sin señales de uso" },
  excellent: { label: "Excelente", hint: "Mínimas señales de uso" },
  good: { label: "Bueno", hint: "Señales de uso normales, funciona perfecto" },
  acceptable: { label: "Aceptable", hint: "Desgaste visible, funciona correctamente" },
} as const;
export type ListingCondition = keyof typeof LISTING_CONDITIONS;

export const AGE_STAGES = {
  pregnancy: "Embarazo",
  "0_3m": "0–3 meses",
  "3_6m": "3–6 meses",
  "6_12m": "6–12 meses",
  "1_2y": "1–2 años",
  "2_4y": "2–4 años",
  "4y_plus": "4+ años",
  all_ages: "Todas las edades",
} as const;
export type AgeStage = keyof typeof AGE_STAGES;

export const DELIVERY_METHODS = {
  shipping: "Envío",
  local_delivery: "Entrega local",
  pickup: "Recoger personalmente",
} as const;
export type DeliveryMethod = keyof typeof DELIVERY_METHODS;

export const LISTING_STATUSES = [
  "draft",
  "pending_review",
  "active",
  "reserved",
  "sold",
  "inactive",
  "rejected",
] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export const LISTING_TYPES = ["single", "bundle"] as const;
export type ListingType = (typeof LISTING_TYPES)[number];

export const ORDER_STATUSES = [
  "pending_payment",
  "paid",
  "in_delivery",
  "delivered",
  "completed",
  "cancelled",
  "refunded",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const keysOf = <T extends object>(o: T) => Object.keys(o) as (keyof T)[];
