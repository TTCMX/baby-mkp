import { describe, expect, it } from "vitest";
import { parseCsv } from "../csv";
import {
  columnOf,
  matchAgeToken,
  matchCategory,
  matchCondition,
  parseAges,
  parsePhotoUrls,
  publicName,
  readSheet,
  TEMPLATE_CSV,
  type ImportCategory,
} from "../rows";

const CATEGORIES: ImportCategory[] = [
  { id: "c-carriolas", slug: "carriolas", name: "Carriolas", age_mode: "range", allows_shipping: true },
  { id: "c-ropa", slug: "ropa", name: "Ropa", age_mode: "exact", allows_shipping: true },
  { id: "c-cunas", slug: "cunas-y-muebles", name: "Cunas y muebles", age_mode: "none", allows_shipping: false },
  { id: "c-sillas", slug: "sillas-de-auto", name: "Sillas de auto", age_mode: "range", allows_shipping: true },
  { id: "c-bano", slug: "bano-y-cuidado", name: "Baño y cuidado", age_mode: "none", allows_shipping: true },
];

describe("parseCsv", () => {
  it("reads quotes, commas and line breaks inside cells, CRLF and BOM", () => {
    const rows = parseCsv('\uFEFFa,b,c\r\n1,"dos, tres","con ""comillas""\ny salto"\r\n\r\n4,5,6\r\n');
    expect(rows).toEqual([
      ["a", "b", "c"],
      ["1", "dos, tres", 'con "comillas"\ny salto'],
      ["4", "5", "6"],
    ]);
  });

  it("detects Excel's semicolon in Spanish locales and tabs", () => {
    expect(parseCsv("a;b\n1,5;2")).toEqual([
      ["a", "b"],
      ["1,5", "2"],
    ]);
    expect(parseCsv("a\tb\n1\t2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("mapping what people type", () => {
  it("headers", () => {
    expect(columnOf("ID Producto")).toBe("ref");
    expect(columnOf("Categoría")).toBe("category");
    expect(columnOf("Descripción")).toBe("description");
    expect(columnOf("cualquier otra")).toBeNull();
  });

  it("categories by slug, name or alias", () => {
    expect(matchCategory("Carreola", CATEGORIES)?.slug).toBe("carriolas");
    expect(matchCategory("cunas-y-muebles", CATEGORIES)?.slug).toBe("cunas-y-muebles");
    expect(matchCategory("Baño y cuidado", CATEGORIES)?.slug).toBe("bano-y-cuidado");
    expect(matchCategory("Autoasiento", CATEGORIES)?.slug).toBe("sillas-de-auto");
    expect(matchCategory("cosas", CATEGORIES)).toBeNull();
  });

  it("conditions", () => {
    expect(matchCondition("Como Nuevo")).toBe("like_new");
    expect(matchCondition("nuevo con etiqueta")).toBe("new_with_tags");
    expect(matchCondition("new_with_tags")).toBe("new_with_tags");
    expect(matchCondition("buen estado")).toBe("good");
    expect(matchCondition("roto")).toBeNull();
  });

  it.each([
    ["RN", "newborn"],
    ["recién nacido", "newborn"],
    ["0-3m", "0_3m"],
    ["0-3 meses", "0_3m"],
    ["0 a 3 meses", "0_3m"],
    ["0_3m", "0_3m"],
    ["6-12 meses", "6_12m"],
    ["1-2 años", "1_2y"],
    ["12-24 meses", "1_2y"],
    ["2-4a", "2_4y"],
    ["4+", "4y_plus"],
    ["+4 años", "4y_plus"],
    ["Todas las edades", "all_ages"],
    ["1-3 meses", "0_3m"],
    ["1 año", "1_2y"],
    ["2 años", "2_4y"],
    ["3 años", "2_4y"],
    ["4 años", "4y_plus"],
    ["embarazo", "pregnancy"],
  ])("age %s → %s", (token, stage) => {
    expect(matchAgeToken(token)).toBe(stage);
  });

  it("age lists and ranges", () => {
    expect(parseAges("0-3m, 3-6m")).toEqual({ stages: ["0_3m", "3_6m"], unknown: [] });
    expect(parseAges("RN a 2-4 años")).toEqual({ stages: ["newborn", "2_4y"], unknown: [] });
    expect(parseAges("0 a 3 meses y 3 a 6 meses")).toEqual({ stages: ["0_3m", "3_6m"], unknown: [] });
    expect(parseAges("bebés")).toEqual({ stages: [], unknown: ["bebés"] });
  });

  it("photo links, incl. shared Drive and Dropbox links", () => {
    expect(
      parsePhotoUrls(
        "https://a.com/1.jpg, https://drive.google.com/file/d/AbC_12-x/view?usp=sharing | https://www.dropbox.com/s/x/f.jpg?dl=0",
      ),
    ).toEqual({
      urls: [
        "https://a.com/1.jpg",
        "https://drive.google.com/uc?export=download&id=AbC_12-x",
        "https://www.dropbox.com/s/x/f.jpg?raw=1",
      ],
      invalid: [],
    });
    expect(parsePhotoUrls("foto.jpg ftp://x/y.jpg").invalid).toEqual(["foto.jpg", "ftp://x/y.jpg"]);
  });

  it("prices with decimal comma or thousands separator", async () => {
    const { normalizePrice } = await import("../rows");
    expect(normalizePrice("316,00")).toBe("316.00");
    expect(normalizePrice("$1,500.00")).toBe("1,500.00"); // thousands comma: parsePriceToCents drops it
    expect(normalizePrice("1500 MXN")).toBe("1500");
    expect(normalizePrice("1,500")).toBe("1,500");
  });

  it("public name keeps only first name + initial", () => {
    expect(publicName("Lucía Martínez Ruiz")).toBe("Lucía M.");
    expect(publicName("Ana")).toBe("Ana");
  });
});

describe("readSheet", () => {
  const opts = { categories: CATEGORIES, maxPhotos: 3 };

  it("accepts the template", () => {
    const { results, missingColumns } = readSheet(parseCsv(TEMPLATE_CSV), opts);
    expect(missingColumns).toEqual([]);
    expect(results.map((r) => r.errors)).toEqual([[], []]);
    const [stroller, clothes] = results.map((r) => r.row!);
    expect(stroller.seller).toMatchObject({ key: "V-01", displayName: "Lucía M.", email: "lucia@example.com" });
    expect(stroller.ageStages).toEqual(["newborn", "0_3m", "3_6m", "6_12m", "1_2y", "2_4y"]); // range filled in
    expect(stroller.photos).toHaveLength(2);
    expect(stroller.priceCents).toBe(450000);
    expect(clothes.bundleItemCount).toBe(20);
    expect(clothes.ageStages).toEqual(["0_3m"]);
  });

  it("reports missing columns", () => {
    expect(readSheet([["titulo", "precio"]], opts).missingColumns).toContain("id_producto");
  });

  it("reports every problem of a row, by line", () => {
    const sheet = [
      ["id_producto", "vendedor_id", "vendedor_nombre", "titulo", "categoria", "condicion", "edad", "precio", "fotos"],
      ["A1", "V1", "Ana Pérez", "Cuna", "cunas", "bueno", "", "$1,200.00", "https://x.com/a.jpg"],
      ["A2", "V1", "Ana P", "Ok", "cosas", "roto", "bebés", "gratis", ""],
      ["A1", "V2", "Beto", "Silla auto", "autoasiento", "excelente", "", "500", "https://x.com/b.jpg"],
    ];
    const { results } = readSheet(sheet, opts);
    expect(results[0].errors).toEqual([]);
    expect(results[0].row!.ageStages).toEqual(["all_ages"]); // furniture: no stage needed
    expect(results[0].row!.priceCents).toBe(120000);
    expect(results[1].line).toBe(3);
    expect(results[1].errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining("título"),
        expect.stringContaining("Categoría desconocida"),
        expect.stringContaining("Condición desconocida"),
        expect.stringContaining("Edad desconocida"),
        expect.stringContaining("Precio inválido"),
        expect.stringContaining("foto"),
        expect.stringContaining("otro nombre"),
      ]),
    );
    expect(results[1].row).toBeUndefined();
    expect(results[2].errors).toEqual(["Falta la edad o etapa", 'id_producto "A1" repetido en el archivo']);
  });
});

describe("isFetchableUrl", () => {
  it("blocks internal addresses unless explicitly allowed", async () => {
    const { isFetchableUrl } = await import("../urls");
    expect(isFetchableUrl("https://ejemplo.com/f.jpg", false)).toBe(true);
    for (const bad of [
      "http://localhost:3000/x.jpg",
      "http://127.0.0.1/x",
      "http://10.0.0.5/x",
      "http://192.168.1.1/x",
      "http://172.20.0.1/x",
      "http://169.254.169.254/latest/meta-data",
      "http://[::1]/x",
      "file:///etc/passwd",
    ])
      expect(isFetchableUrl(bad, false)).toBe(false);
    expect(isFetchableUrl("http://127.0.0.1:8080/x.png", true)).toBe(true);
  });
});
