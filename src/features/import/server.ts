import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import sharp from "sharp";
import { DELIVERY_METHODS, type DeliveryMethod } from "@/lib/domain/constants";
import { LISTING_IMAGES_BUCKET, listingFolder, thumbPath } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { norm, type ImportRow, type ImportSeller } from "./rows";
import { isFetchableUrl } from "./urls";

// Bulk import of managed sellers' products (admins only; callers check that).
// Everything is keyed by the spreadsheet ids, so running the same file again
// updates what changed and skips the rest.

export type Warehouse = {
  city: string;
  municipality: string | null;
  state: string | null;
  deliveryMethods: DeliveryMethod[];
  shippingPriceCents: number | null;
};

export type RowOutcome = {
  line: number;
  ref: string;
  status: "created" | "updated" | "unchanged" | "skipped" | "error";
  message?: string;
};

type Db = ReturnType<typeof createAdminClient>;

const MAX_PHOTO_BYTES = 15 * 1024 * 1024;
const PHOTO_TIMEOUT_MS = 20_000;

// ------------------------------------------------------------------ sellers

function usernameFor(displayName: string) {
  const base =
    norm(displayName)
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 20) || "vendedora";
  return `${base}_${randomBytes(3).toString("hex")}`;
}

/**
 * Finds or creates the managed profile of each seller (by spreadsheet id).
 * Managed profiles can't sign in: placeholder email on a reserved domain and a
 * random password nobody knows. Returns spreadsheet id → profile id.
 */
export async function ensureSellers(sellers: ImportSeller[], warehouse: Warehouse): Promise<Map<string, string>> {
  const db = createAdminClient();
  const ids = await findSellers(sellers.map((s) => s.key));

  for (const s of sellers) {
    let id = ids.get(s.key);
    if (!id) {
      const { data, error: authError } = await db.auth.admin.createUser({
        email: `gestionado-${randomUUID()}@gestionado.invalid`,
        password: randomBytes(24).toString("base64url"),
        email_confirm: true,
        user_metadata: { display_name: s.displayName, managed: true },
      });
      if (authError || !data.user) throw authError ?? new Error("create_user_failed");
      id = data.user.id;
      const { error: keyError } = await db.from("private_profiles").update({ owner_key: s.key }).eq("id", id);
      if (keyError) {
        // Another batch created this seller first: keep theirs.
        await db.auth.admin.deleteUser(id);
        const { data: winner } = await db.from("private_profiles").select("id").eq("owner_key", s.key).single();
        ids.set(s.key, winner!.id as string);
        continue;
      }
      await db
        .from("profiles")
        .update({ username: usernameFor(s.displayName), is_managed: true })
        .eq("id", id);
      ids.set(s.key, id);
    }
    // Keep public name, location and private contact in sync with the sheet.
    await db
      .from("profiles")
      .update({ display_name: s.displayName, city: warehouse.city, municipality: warehouse.municipality })
      .eq("id", id);
    await db.from("private_profiles").update({ owner_name: s.name, owner_email: s.email, phone: s.phone }).eq("id", id);
  }
  return ids;
}

/** Spreadsheet id → managed profile id, for the sellers that already exist. */
export async function findSellers(keys: string[]): Promise<Map<string, string>> {
  const { data, error } = await createAdminClient()
    .from("private_profiles")
    .select("id, owner_key")
    .in("owner_key", [...new Set(keys)]);
  if (error) throw error;
  return new Map((data ?? []).map((e) => [e.owner_key as string, e.id as string]));
}

// ------------------------------------------------------------------- photos

async function download(url: string): Promise<Buffer> {
  if (!isFetchableUrl(url)) throw new Error("enlace no permitido");
  const res = await fetch(url, { signal: AbortSignal.timeout(PHOTO_TIMEOUT_MS), redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const type = res.headers.get("content-type") ?? "";
  // Drive serves files as octet-stream; anything that isn't an image fails in sharp below.
  if (type && !type.startsWith("image/") && !type.startsWith("application/octet-stream")) {
    throw new Error(`no es una imagen (${type.split(";")[0]})`);
  }
  if (Number(res.headers.get("content-length") ?? 0) > MAX_PHOTO_BYTES) throw new Error("foto de más de 15 MB");
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_PHOTO_BYTES) throw new Error("foto de más de 15 MB");
  return buf;
}

/** Same output as the sell wizard: WebP ≤1600 px + thumbnail ≤600 px, EXIF orientation applied. */
async function processPhoto(input: Buffer) {
  const base = sharp(input, { failOn: "error" }).rotate();
  const { data: full, info } = await base
    .clone()
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });
  const thumb = await base
    .clone()
    .resize({ width: 600, height: 600, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 78 })
    .toBuffer();
  return { full, thumb, width: info.width, height: info.height };
}

type StoredPhoto = { storage_path: string; width: number; height: number; source_url: string };

async function storePhotos(db: Db, urls: string[], sellerId: string, listingId: string): Promise<StoredPhoto[]> {
  const stored: StoredPhoto[] = [];
  try {
    for (const [i, url] of urls.entries()) {
      let photo;
      try {
        photo = await processPhoto(await download(url));
      } catch (err) {
        throw new Error(`Foto ${i + 1}: ${err instanceof Error ? err.message : "no se pudo leer"}`);
      }
      const path = `${listingFolder(sellerId, listingId)}${randomUUID()}.webp`;
      for (const [p, body] of [
        [path, photo.full],
        [thumbPath(path), photo.thumb],
      ] as const) {
        const { error } = await db.storage
          .from(LISTING_IMAGES_BUCKET)
          .upload(p, body, { contentType: "image/webp", upsert: false, cacheControl: "31536000" });
        if (error) throw new Error(`No pudimos guardar la foto ${i + 1}`);
      }
      stored.push({ storage_path: path, width: photo.width, height: photo.height, source_url: url });
    }
    return stored;
  } catch (err) {
    await removePhotos(
      db,
      stored.map((s) => s.storage_path),
    );
    throw err;
  }
}

async function removePhotos(db: Db, paths: string[]) {
  if (!paths.length) return;
  await db.storage.from(LISTING_IMAGES_BUCKET).remove(paths.flatMap((p) => [p, thumbPath(p)]));
}

// ----------------------------------------------------------------- listings

export async function importRows(
  rows: ImportRow[],
  sellerIds: Map<string, string>,
  warehouse: Warehouse,
  categoryShipping: Map<string, boolean>,
): Promise<RowOutcome[]> {
  const db = createAdminClient();
  const { data: existing } = await db
    .from("listings")
    .select("id, seller_id, status, external_ref, listing_images(storage_path, source_url, position)")
    .in(
      "external_ref",
      rows.map((r) => r.ref),
    );
  const byRef = new Map((existing ?? []).map((l) => [l.external_ref as string, l]));

  const outcomes: RowOutcome[] = [];
  for (const row of rows) {
    try {
      outcomes.push(await importRow(db, row, byRef.get(row.ref), sellerIds, warehouse, categoryShipping));
    } catch (err) {
      outcomes.push({
        line: row.line,
        ref: row.ref,
        status: "error",
        message: err instanceof Error ? err.message : "Error inesperado",
      });
    }
  }
  return outcomes;
}

type Existing = {
  id: string;
  seller_id: string;
  status: string;
  listing_images: { storage_path: string; source_url: string | null; position: number }[];
};

async function importRow(
  db: Db,
  row: ImportRow,
  existing: Existing | undefined,
  sellerIds: Map<string, string>,
  warehouse: Warehouse,
  categoryShipping: Map<string, boolean>,
): Promise<RowOutcome> {
  const sellerId = sellerIds.get(row.seller.key);
  if (!sellerId) throw new Error("Vendedor no creado");
  const deliveryMethods = warehouse.deliveryMethods.filter(
    (m) => m !== "shipping" || categoryShipping.get(row.categoryId) !== false,
  );
  if (!deliveryMethods.length) {
    throw new Error(`Esta categoría no admite ${DELIVERY_METHODS.shipping.toLowerCase()} y no elegiste otra entrega`);
  }

  const fields = {
    title: row.title,
    description: row.description,
    category_id: row.categoryId,
    brand: row.brand,
    model: row.model,
    condition: row.condition,
    age_stages: row.ageStages,
    gender: row.gender,
    listing_type: row.bundleItemCount ? "bundle" : "single",
    bundle_item_count: row.bundleItemCount,
    price_cents: row.priceCents,
    city: warehouse.city,
    municipality: warehouse.municipality,
    state: warehouse.state,
    delivery_methods: deliveryMethods,
    // Shipping has one platform-wide price (Admin → Ajustes).
    shipping_price_cents: null,
  };

  if (existing) {
    if (existing.seller_id !== sellerId) throw new Error("Este id_producto ya pertenece a otro vendedor");
    if (existing.status === "sold" || existing.status === "reserved") {
      return { line: row.line, ref: row.ref, status: "skipped", message: "Ya vendido o en compra: no se modificó" };
    }
    const current = [...existing.listing_images].sort((a, b) => a.position - b.position);
    const photosChanged = current.map((i) => i.source_url).join("\n") !== row.photos.join("\n");
    if (photosChanged) {
      const photos = await storePhotos(db, row.photos, sellerId, existing.id);
      const { data: old } = await db.from("listing_images").select("*").eq("listing_id", existing.id);
      await db.from("listing_images").delete().eq("listing_id", existing.id);
      const { error } = await db
        .from("listing_images")
        .insert(photos.map((p, position) => ({ listing_id: existing.id, position, ...p })));
      if (error) {
        if (old?.length) await db.from("listing_images").insert(old); // put the previous photos back
        await removePhotos(
          db,
          photos.map((p) => p.storage_path),
        );
        throw new Error("No pudimos actualizar las fotos");
      }
      await removePhotos(
        db,
        current.map((i) => i.storage_path),
      );
    }
    const { data: before } = await db.from("listings").select("*").eq("id", existing.id).single();
    const changed = Object.entries(fields).some(([k, v]) => JSON.stringify(before?.[k]) !== JSON.stringify(v));
    if (changed) {
      const { error } = await db.from("listings").update(fields).eq("id", existing.id);
      if (error) throw new Error("No pudimos actualizar el producto");
    }
    return { line: row.line, ref: row.ref, status: changed || photosChanged ? "updated" : "unchanged" };
  }

  const id = randomUUID();
  const photos = await storePhotos(db, row.photos, sellerId, id);
  const { error } = await db.from("listings").insert({
    id,
    seller_id: sellerId,
    external_ref: row.ref,
    ...fields,
    status: "active",
    published_at: new Date().toISOString(),
  });
  if (error) {
    await removePhotos(
      db,
      photos.map((p) => p.storage_path),
    );
    if (error.code === "23505") throw new Error("Ese id_producto se está importando en otro lote; vuelve a intentar");
    throw new Error("No pudimos crear el producto");
  }
  const { error: imgError } = await db
    .from("listing_images")
    .insert(photos.map((p, position) => ({ listing_id: id, position, ...p })));
  if (imgError) {
    await db.from("listings").delete().eq("id", id);
    await removePhotos(
      db,
      photos.map((p) => p.storage_path),
    );
    throw new Error("No pudimos guardar las fotos del producto");
  }
  return { line: row.line, ref: row.ref, status: "created" };
}
