import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { DELIVERY_METHODS, keysOf } from "@/lib/domain/constants";
import { getPlatformSettings } from "@/lib/settings";
import { getActiveCategories } from "@/features/listings/queries";
import { readSheet, type ImportCategory, type ImportSeller } from "@/features/import/rows";
import { ensureSellers, findSellers, importRows, type RowOutcome } from "@/features/import/server";

// Photos are downloaded and resized here: give each batch time.
export const maxDuration = 300;

const deliveryKeys = keysOf(DELIVERY_METHODS) as [keyof typeof DELIVERY_METHODS, ...(keyof typeof DELIVERY_METHODS)[]];

const bodySchema = z.object({
  phase: z.enum(["sellers", "rows"]),
  header: z.array(z.string().max(200)).max(100),
  rows: z
    .array(z.object({ line: z.number().int().positive(), cells: z.array(z.string().max(10_000)).max(100) }))
    .min(1)
    .max(200),
  warehouse: z.object({
    city: z.string().trim().min(1).max(80),
    municipality: z.string().trim().max(80).nullable(),
    state: z.string().trim().max(80).nullable(),
    deliveryMethods: z.array(z.enum(deliveryKeys)).min(1),
    shippingPriceCents: z.number().int().min(0).max(10_000_000).nullable(),
  }),
});

/**
 * Bulk import of managed sellers' products, called by /admin/import in small
 * batches: "sellers" creates the profiles once, then "rows" creates/updates the
 * products. The sheet is validated again here: the browser's report is only a preview.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.profile.role !== "admin" || user.profile.status !== "active") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const { phase, header, rows, warehouse } = parsed.data;

  const [categories, settings] = await Promise.all([getActiveCategories(), getPlatformSettings()]);
  const sheet = readSheet([header, ...rows.map((r) => r.cells)], {
    categories: categories as ImportCategory[],
    maxPhotos: settings.max_images_per_listing,
  });
  if (sheet.missingColumns.length) {
    return NextResponse.json({ error: `Faltan columnas: ${sheet.missingColumns.join(", ")}` }, { status: 400 });
  }
  // Results come back in the order sent: restore the file's line numbers.
  sheet.results.forEach((r, i) => {
    r.line = rows[i].line;
    if (r.row) r.row.line = rows[i].line;
  });
  const valid = sheet.results.flatMap((r) => (r.row ? [r.row] : []));

  try {
    if (phase === "sellers") {
      const unique = new Map<string, ImportSeller>();
      for (const r of valid) if (!unique.has(r.seller.key)) unique.set(r.seller.key, r.seller);
      const ids = await ensureSellers([...unique.values()], warehouse);
      return NextResponse.json({ sellers: ids.size });
    }

    const outcomes: RowOutcome[] = sheet.results
      .filter((r) => !r.row)
      .map((r) => ({ line: r.line, ref: r.ref, status: "error" as const, message: r.errors.join(" · ") }));
    const sellerIds = await findSellers(valid.map((r) => r.seller.key));
    const shipping = new Map(categories.map((c) => [c.id, c.allows_shipping]));
    outcomes.push(...(await importRows(valid, sellerIds, warehouse, shipping)));
    return NextResponse.json({ outcomes: outcomes.sort((a, b) => a.line - b.line) });
  } catch (err) {
    console.error("[import] batch failed", err);
    return NextResponse.json({ error: "No pudimos procesar este lote" }, { status: 500 });
  }
}
