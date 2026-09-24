import { z } from "zod";
import { AGE_STAGES, DELIVERY_METHODS, LISTING_CONDITIONS, keysOf } from "@/lib/domain/constants";

// Shared by the sell wizard (instant feedback) and the server action (authority).

export const MIN_PRICE_CENTS = 1_000; // $10 MXN, mirrors the DB check constraint
export const MAX_PRICE_CENTS = 100_000_000;

const conditionKeys = keysOf(LISTING_CONDITIONS) as [
  keyof typeof LISTING_CONDITIONS,
  ...(keyof typeof LISTING_CONDITIONS)[],
];
const ageKeys = keysOf(AGE_STAGES) as [keyof typeof AGE_STAGES, ...(keyof typeof AGE_STAGES)[]];
const deliveryKeys = keysOf(DELIVERY_METHODS) as [keyof typeof DELIVERY_METHODS, ...(keyof typeof DELIVERY_METHODS)[]];

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v));

export const listingImageSchema = z.object({
  storage_path: z.string().min(1).max(300),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
});

export const listingInputSchema = z
  .object({
    id: z.uuid(),
    title: z.string().trim().min(3, "El título debe tener al menos 3 caracteres").max(90, "Máximo 90 caracteres"),
    description: z.string().trim().max(4000, "Máximo 4000 caracteres"),
    categoryId: z.uuid("Elige una categoría"),
    brand: optionalText(60),
    model: optionalText(80),
    condition: z.enum(conditionKeys, "Elige la condición"),
    ageStages: z.array(z.enum(ageKeys)).min(1, "Elige al menos una edad o etapa"),
    isBundle: z.boolean(),
    bundleItemCount: z.number().int().min(2).max(500).nullable(),
    priceCents: z
      .number("Escribe un precio válido")
      .int()
      .min(MIN_PRICE_CENTS, "El precio mínimo es $10")
      .max(MAX_PRICE_CENTS, "Precio demasiado alto"),
    city: z.string().trim().min(1, "Escribe la ciudad").max(80),
    municipality: optionalText(80),
    deliveryMethods: z.array(z.enum(deliveryKeys)).min(1, "Elige al menos una forma de entrega"),
    shippingPriceCents: z.number().int().min(0).max(MAX_PRICE_CENTS).nullable(),
    images: z.array(listingImageSchema).min(1, "Agrega al menos una foto").max(20),
  })
  .superRefine((v, ctx) => {
    if (v.isBundle && !v.bundleItemCount) {
      ctx.addIssue({ code: "custom", path: ["bundleItemCount"], message: "¿Cuántas piezas incluye el lote?" });
    }
  });

export type ListingInput = z.input<typeof listingInputSchema>;
export type ListingImageInput = z.infer<typeof listingImageSchema>;
