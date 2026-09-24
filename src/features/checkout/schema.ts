import { z } from "zod";

export const addressSchema = z.object({
  recipientName: z.string().trim().min(2, "Escribe el nombre de quien recibe").max(120),
  phone: z
    .string()
    .trim()
    .regex(/^[+\d\s()-]{8,20}$/, "Escribe un teléfono válido"),
  street: z.string().trim().min(3, "Escribe la calle").max(200),
  exteriorNumber: z.string().trim().min(1, "Número exterior").max(20),
  interiorNumber: z.string().trim().max(20).optional().default(""),
  neighborhood: z.string().trim().min(2, "Escribe la colonia").max(120),
  municipality: z.string().trim().min(2, "Escribe la alcaldía o municipio").max(80),
  city: z.string().trim().min(2, "Escribe la ciudad").max(80),
  state: z.string().trim().min(2, "Escribe el estado").max(80),
  postalCode: z
    .string()
    .trim()
    .regex(/^\d{5}$/, "El código postal tiene 5 dígitos"),
  references: z.string().trim().max(300).optional().default(""),
});

export type AddressInput = z.infer<typeof addressSchema>;

export const checkoutSchema = z.object({
  listingId: z.uuid(),
  deliveryMethod: z.enum(["shipping", "local_delivery", "pickup"], "Elige cómo quieres recibirlo"),
});

export const CHECKOUT_ERRORS: Record<string, string> = {
  listing_unavailable: "Alguien más está comprando este producto o ya se vendió.",
  listing_not_found: "Este producto ya no está disponible.",
  own_listing: "No puedes comprar tu propio producto.",
  buyer_not_allowed: "Tu cuenta no puede comprar en este momento.",
  delivery_not_offered: "Esa forma de entrega no está disponible para este producto.",
  price_changed: "El precio cambió. Revisa el producto de nuevo.",
  shipping_changed: "El costo de envío cambió. Revisa el producto de nuevo.",
  address_required: "Necesitamos tu dirección para la entrega.",
};
