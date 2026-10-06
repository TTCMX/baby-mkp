export const SITE_NAME = "mercadito.baby";
export const SITE_TAGLINE =
  "Compra productos de bebé de segunda mano de forma sencilla y confiable, y vende los que tu bebé ya no necesita sin complicaciones.";

/** Canonical origin for absolute URLs (metadata, sitemap). Set NEXT_PUBLIC_SITE_URL in production. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/, "");

/** Routes that only make sense signed in: never indexed. */
export const PRIVATE_PATHS = [
  "/sell",
  "/orders",
  "/checkout",
  "/settings",
  "/admin",
  "/notifications",
  "/babies",
  "/balance",
  "/favorites",
  "/messages",
  "/suspended",
  "/auth",
  "/api",
];
