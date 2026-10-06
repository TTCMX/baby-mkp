// Spreadsheet rows → listings of managed sellers. Pure (no I/O): used by the
// admin importer in the browser (instant report) and by the import API (authority).
import { normalizeAgeStages } from "@/lib/domain/age-mode";
import { type AgeStage, type CategoryAgeMode, type ListingCondition } from "@/lib/domain/constants";
import { parsePriceToCents } from "@/lib/money";
import { MAX_PRICE_CENTS, MIN_PRICE_CENTS } from "@/features/listings/schema";

export type ImportCategory = {
  id: string;
  slug: string;
  name: string;
  age_mode: CategoryAgeMode;
  allows_shipping: boolean;
};

export type ImportSeller = {
  key: string;
  name: string;
  displayName: string;
  email: string | null;
  phone: string | null;
};

export type ImportRow = {
  line: number;
  ref: string;
  seller: ImportSeller;
  title: string;
  description: string;
  categoryId: string;
  condition: ListingCondition;
  ageStages: AgeStage[];
  priceCents: number;
  brand: string | null;
  model: string | null;
  photos: string[];
  bundleItemCount: number | null;
};

export type RowResult = { line: number; ref: string; errors: string[]; row?: ImportRow };

/** Columns of the template, and the other names people tend to use for them. */
export const COLUMNS = {
  ref: ["id_producto", "id", "sku", "codigo"],
  sellerKey: ["vendedor_id", "id_vendedor", "vendedor", "dueno_id"],
  sellerName: ["vendedor_nombre", "nombre_vendedor", "dueno", "nombre"],
  sellerAlias: ["vendedor_alias", "nombre_publico", "alias"],
  sellerEmail: ["vendedor_email", "email_vendedor", "correo"],
  sellerPhone: ["vendedor_telefono", "telefono_vendedor", "telefono"],
  title: ["titulo", "nombre_producto", "producto"],
  description: ["descripcion"],
  category: ["categoria"],
  condition: ["condicion", "estado"],
  ages: ["edad", "edades", "etapa", "etapas"],
  price: ["precio"],
  brand: ["marca"],
  model: ["modelo"],
  photos: ["fotos", "imagenes", "fotos_urls"],
  pieces: ["piezas", "lote_piezas"],
} as const;
type Column = keyof typeof COLUMNS;

export const TEMPLATE_CSV =
  "id_producto,vendedor_id,vendedor_nombre,vendedor_alias,vendedor_email,vendedor_telefono,titulo,descripcion,categoria,condicion,edad,precio,marca,modelo,fotos,piezas\r\n" +
  'P-0001,V-01,Lucía Martínez Ruiz,,lucia@example.com,55 1234 5678,Carriola Nuna Mixx,"Muy cuidada, incluye cubre lluvia",carriolas,como nuevo,RN a 2-4 años,4500,Nuna,Mixx,https://ejemplo.com/foto1.jpg https://ejemplo.com/foto2.jpg,\r\n' +
  "P-0002,V-01,Lucía Martínez Ruiz,,,,Lote ropa niña,20 prendas,ropa,bueno,0-3m,850,,,https://ejemplo.com/foto3.jpg,20\r\n";

/** Lowercase, no accents, single spaces: for matching what people type. */
export function norm(v: string): string {
  return v
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9+]+/g, " ")
    .trim();
}

/** Header cell → template column (null if we don't use it). */
export function columnOf(header: string): Column | null {
  const h = norm(header).replace(/ /g, "_");
  for (const [col, names] of Object.entries(COLUMNS))
    if ((names as readonly string[]).includes(h)) return col as Column;
  return null;
}

// ------------------------------------------------------------------ mapping
const CATEGORY_ALIASES: Record<string, string> = {
  carreola: "carriolas",
  carreolas: "carriolas",
  carriola: "carriolas",
  autoasiento: "sillas-de-auto",
  autoasientos: "sillas-de-auto",
  "silla de auto": "sillas-de-auto",
  "silla auto": "sillas-de-auto",
  "silla para auto": "sillas-de-auto",
  cuna: "cunas-y-muebles",
  cunas: "cunas-y-muebles",
  muebles: "cunas-y-muebles",
  mueble: "cunas-y-muebles",
  biberones: "alimentacion",
  lactancia: "alimentacion",
  "silla alta": "alimentacion",
  periquera: "alimentacion",
  monitor: "monitores-y-electronicos",
  monitores: "monitores-y-electronicos",
  electronicos: "monitores-y-electronicos",
  juguete: "juguetes",
  zapato: "zapatos",
  calzado: "zapatos",
  accesorio: "accesorios",
  panalera: "accesorios",
  portabebe: "accesorios",
  bano: "bano-y-cuidado",
  tina: "bano-y-cuidado",
  banera: "bano-y-cuidado",
  otro: "otros",
};

export function matchCategory(value: string, categories: ImportCategory[]): ImportCategory | null {
  const v = norm(value);
  if (!v) return null;
  const bySlugOrName = categories.find((c) => norm(c.slug) === v || norm(c.name) === v);
  if (bySlugOrName) return bySlugOrName;
  const alias = CATEGORY_ALIASES[v];
  return alias ? (categories.find((c) => c.slug === alias) ?? null) : null;
}

const CONDITIONS: Record<string, ListingCondition> = {
  "nuevo con etiquetas": "new_with_tags",
  "nuevo con etiqueta": "new_with_tags",
  nuevo: "new_with_tags",
  "new with tags": "new_with_tags",
  "como nuevo": "like_new",
  seminuevo: "like_new",
  "semi nuevo": "like_new",
  "like new": "like_new",
  excelente: "excellent",
  "muy bueno": "excellent",
  excellent: "excellent",
  bueno: "good",
  "buen estado": "good",
  good: "good",
  aceptable: "acceptable",
  regular: "acceptable",
  usado: "acceptable",
  acceptable: "acceptable",
};

export function matchCondition(value: string): ListingCondition | null {
  return CONDITIONS[norm(value)] ?? null;
}

// Normalised (no spaces or dashes) spellings of each stage.
const AGE_TOKENS: Record<string, AgeStage> = {
  embarazo: "pregnancy",
  maternidad: "pregnancy",
  pregnancy: "pregnancy",
  rn: "newborn",
  reciennacido: "newborn",
  newborn: "newborn",
  "01m": "newborn",
  "03m": "0_3m",
  "36m": "3_6m",
  "612m": "6_12m",
  "12y": "1_2y",
  "1224m": "1_2y",
  "24y": "2_4y",
  "4+": "4y_plus",
  "4+y": "4y_plus",
  "+4": "4y_plus",
  "+4y": "4y_plus",
  "4yplus": "4y_plus",
  masde4y: "4y_plus",
  todas: "all_ages",
  todaslasedades: "all_ages",
  allages: "all_ages",
  cualquieredad: "all_ages",
};

/** "0-3 meses", "0 a 3 meses", "RN", "1-2 años", "4+", "todas"… → stage key. */
export function matchAgeToken(token: string): AgeStage | null {
  const t = norm(token)
    .replace(/ (a|al|hasta) (?=\d)/g, "-") // "0 a 3 meses" (before "a" is read as años)
    // Units right after a number or on their own: "3m", "2-4a", "1 año".
    .replace(/(?<=\d|\s|^)(meses|mes|m)\b/g, "m")
    .replace(/(?<=\d|\s|^)(anos|ano|a|y)\b/g, "y")
    .replace(/[\s-]/g, "");
  return AGE_TOKENS[t] ?? null;
}

/** "RN a 2-4 años" (a range: ends of it) or "0-3m, 3-6m" (a list). */
export function parseAges(value: string): { stages: AgeStage[]; unknown: string[] } {
  const parts = value
    // "… a …" separates a range only after a full stage ("RN a 2-4 años"), not inside one ("0 a 3 meses").
    .split(/[,;|/]|\s+y\s+|(?<=(?:meses|mes|m|años|anos|año|ano|rn|RN|\+))\s+a\s+/i)
    .map((p) => p.trim())
    .filter(Boolean);
  const stages: AgeStage[] = [];
  const unknown: string[] = [];
  for (const p of parts) {
    const stage = matchAgeToken(p);
    if (stage) stages.push(stage);
    else unknown.push(p);
  }
  return { stages, unknown };
}

/** Links separated by spaces, commas, ";" or "|". Shared Google Drive / Dropbox links become direct downloads. */
export function parsePhotoUrls(value: string): { urls: string[]; invalid: string[] } {
  const urls: string[] = [];
  const invalid: string[] = [];
  for (const raw of value.split(/[\s,;|]+/).filter(Boolean)) {
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      invalid.push(raw);
      continue;
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      invalid.push(raw);
      continue;
    }
    const drive =
      url.hostname === "drive.google.com" &&
      (url.pathname.match(/\/file\/d\/([\w-]+)/)?.[1] ?? url.searchParams.get("id"));
    if (drive) urls.push(`https://drive.google.com/uc?export=download&id=${drive}`);
    else if (url.hostname.endsWith("dropbox.com")) {
      url.searchParams.delete("dl");
      url.searchParams.set("raw", "1");
      urls.push(url.toString());
    } else urls.push(url.toString());
  }
  return { urls, invalid };
}

/** "Lucía Martínez Ruiz" → "Lucía M." (first name + initial: never the full name). */
export function publicName(fullName: string): string {
  const [first, second] = fullName.trim().split(/\s+/);
  if (!first) return "Vendedora";
  return (second ? `${first} ${second[0].toUpperCase()}.` : first).slice(0, 60);
}

// ------------------------------------------------------------------- rows
type Options = { categories: ImportCategory[]; maxPhotos: number };

/** Validates a whole sheet: header + rows. Returns one result per data row. */
export function readSheet(cells: string[][], opts: Options): { results: RowResult[]; missingColumns: string[] } {
  const [header = [], ...data] = cells;
  const index = new Map<Column, number>();
  header.forEach((h, i) => {
    const col = columnOf(h);
    if (col && !index.has(col)) index.set(col, i);
  });
  const required: Column[] = ["ref", "sellerKey", "sellerName", "title", "category", "condition", "price", "photos"];
  const missingColumns = required.filter((c) => !index.has(c)).map((c) => COLUMNS[c][0]);
  if (missingColumns.length) return { results: [], missingColumns };

  const seen = new Set<string>();
  const sellers = new Map<string, string>();
  const results = data.map((cells, i) => {
    const get = (c: Column) => (index.has(c) ? (cells[index.get(c)!] ?? "").trim() : "");
    const result = validateRow(i + 2, get, opts);
    if (result.ref) {
      if (seen.has(result.ref)) result.errors.push(`id_producto "${result.ref}" repetido en el archivo`);
      seen.add(result.ref);
    }
    const [key, name] = [get("sellerKey"), get("sellerName")];
    if (key && name) {
      const prev = sellers.get(key);
      if (prev && prev !== name) result.errors.push(`El vendedor ${key} aparece con otro nombre ("${prev}")`);
      else sellers.set(key, name);
    }
    if (result.errors.length) delete result.row;
    return result;
  });
  return { results, missingColumns: [] };
}

function validateRow(line: number, get: (c: Column) => string, { categories, maxPhotos }: Options): RowResult {
  const errors: string[] = [];
  const ref = get("ref").slice(0, 100);
  if (!ref) errors.push("Falta id_producto");

  const sellerKey = get("sellerKey").slice(0, 100);
  const sellerName = get("sellerName").slice(0, 120);
  if (!sellerKey) errors.push("Falta vendedor_id");
  if (sellerName.length < 2) errors.push("Falta vendedor_nombre");
  const alias = get("sellerAlias");
  const email = get("sellerEmail");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push(`Correo inválido: ${email}`);

  const title = get("title");
  if (title.length < 3 || title.length > 90) errors.push("El título debe tener entre 3 y 90 caracteres");
  const description = get("description");
  if (description.length > 4000) errors.push("Descripción de más de 4000 caracteres");

  const category = matchCategory(get("category"), categories);
  if (!category) errors.push(`Categoría desconocida: "${get("category")}"`);
  const condition = matchCondition(get("condition"));
  if (!condition) errors.push(`Condición desconocida: "${get("condition")}"`);

  const { stages, unknown } = parseAges(get("ages"));
  if (unknown.length) errors.push(`Edad desconocida: ${unknown.map((u) => `"${u}"`).join(", ")}`);
  const ageStages = category ? normalizeAgeStages(category.age_mode, stages) : [];
  if (category && !ageStages.length && !unknown.length) errors.push("Falta la edad o etapa");

  const priceCents = parsePriceToCents(get("price").replace(/mxn/i, ""));
  if (priceCents === null) errors.push(`Precio inválido: "${get("price")}"`);
  else if (priceCents < MIN_PRICE_CENTS || priceCents > MAX_PRICE_CENTS)
    errors.push("Precio fuera de rango (mínimo $10)");

  const { urls, invalid } = parsePhotoUrls(get("photos"));
  if (invalid.length) errors.push(`Enlace de foto inválido: ${invalid[0]}`);
  if (!urls.length && !invalid.length) errors.push("Falta al menos una foto");
  if (urls.length > maxPhotos) errors.push(`Máximo ${maxPhotos} fotos`);

  const piecesRaw = get("pieces");
  const pieces = piecesRaw ? Number(piecesRaw) : null;
  if (piecesRaw && (!Number.isInteger(pieces) || pieces! < 2 || pieces! > 500))
    errors.push("piezas: número de 2 a 500");

  const row: ImportRow | undefined =
    category && condition && priceCents !== null
      ? {
          line,
          ref,
          seller: {
            key: sellerKey,
            name: sellerName,
            displayName: (alias || publicName(sellerName)).slice(0, 60),
            email: email || null,
            phone: get("sellerPhone").slice(0, 30) || null,
          },
          title,
          description,
          categoryId: category.id,
          condition,
          ageStages,
          priceCents,
          brand: get("brand").slice(0, 60) || null,
          model: get("model").slice(0, 80) || null,
          photos: urls,
          bundleItemCount: pieces,
        }
      : undefined;
  return { line, ref, errors, row };
}
