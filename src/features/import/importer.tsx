"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DELIVERY_METHODS, keysOf, type DeliveryMethod } from "@/lib/domain/constants";
import { parsePriceToCents } from "@/lib/money";
import { parseCsv } from "./csv";
import { readSheet, TEMPLATE_CSV, type ImportCategory, type RowResult } from "./rows";

type Outcome = {
  line: number;
  ref: string;
  status: "created" | "updated" | "unchanged" | "skipped" | "error";
  message?: string;
};
type Sheet = { header: string[]; rows: { line: number; cells: string[] }[]; results: RowResult[]; missing: string[] };

const BATCH = 5; // products per request (each downloads and resizes its photos)
const CONCURRENCY = 3;
const STATUS_LABELS: Record<Outcome["status"], string> = {
  created: "Creados",
  updated: "Actualizados",
  unchanged: "Sin cambios",
  skipped: "Omitidos (ya vendidos)",
  error: "Con error",
};

function csvOf(lines: string[][]) {
  const cell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return "﻿" + lines.map((l) => l.map(cell).join(",")).join("\r\n");
}

function downloadCsv(name: string, lines: string[][]) {
  const url = URL.createObjectURL(new Blob([csvOf(lines)], { type: "text/csv;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  a.click();
  URL.revokeObjectURL(url);
}

export function Importer({ categories, maxPhotos }: { categories: ImportCategory[]; maxPhotos: number }) {
  const [fileName, setFileName] = useState("");
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [city, setCity] = useState("");
  const [municipality, setMunicipality] = useState("");
  const [state, setState] = useState("");
  const [delivery, setDelivery] = useState<DeliveryMethod[]>(["pickup"]);
  const [shippingPrice, setShippingPrice] = useState("");
  const [phase, setPhase] = useState<"idle" | "sellers" | "rows" | "done">("idle");
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [fatal, setFatal] = useState<string | null>(null);
  const stop = useRef(false);

  const valid = useMemo(() => (sheet ? sheet.results.filter((r) => r.row) : []), [sheet]);
  const invalid = useMemo(() => (sheet ? sheet.results.filter((r) => !r.row) : []), [sheet]);
  const sellers = useMemo(() => new Set(valid.map((r) => r.row!.seller.key)).size, [valid]);
  const photos = useMemo(() => valid.reduce((n, r) => n + r.row!.photos.length, 0), [valid]);
  const running = phase === "sellers" || phase === "rows";

  useEffect(() => {
    if (!running) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [running]);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setFileName(file.name);
    setOutcomes([]);
    setPhase("idle");
    setFatal(null);
    const cells = parseCsv(await file.text());
    const { results, missingColumns } = readSheet(cells, { categories, maxPhotos });
    setSheet({
      header: cells[0] ?? [],
      rows: cells.slice(1).map((c, i) => ({ line: i + 2, cells: c })),
      results,
      missing: missingColumns,
    });
  }

  const shippingCents = delivery.includes("shipping") ? (parsePriceToCents(shippingPrice || "0") ?? -1) : null;
  const warehouseValid =
    city.trim().length > 0 && delivery.length > 0 && (shippingCents === null || shippingCents >= 0);
  const warehouse = {
    city: city.trim(),
    municipality: municipality.trim() || null,
    state: state.trim() || null,
    deliveryMethods: delivery,
    shippingPriceCents: shippingCents,
  };

  async function post(phaseName: "sellers" | "rows", rows: Sheet["rows"]) {
    const res = await fetch("/api/admin/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phase: phaseName, header: sheet!.header, rows, warehouse }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
    return body;
  }

  async function run() {
    if (!sheet) return;
    stop.current = false;
    setOutcomes([]);
    setFatal(null);
    const byLine = new Map(sheet.rows.map((r) => [r.line, r]));
    const refOf = new Map(valid.map((r) => [r.line, r.ref]));
    const validRows = valid.map((r) => byLine.get(r.line)!);

    // 1. One row per seller → create the managed profiles first (sequential, avoids duplicates).
    setPhase("sellers");
    const firstOfSeller = new Map<string, Sheet["rows"][number]>();
    for (const r of valid)
      if (!firstOfSeller.has(r.row!.seller.key)) firstOfSeller.set(r.row!.seller.key, byLine.get(r.line)!);
    const sellerRows = [...firstOfSeller.values()];
    try {
      for (let i = 0; i < sellerRows.length && !stop.current; i += 20)
        await post("sellers", sellerRows.slice(i, i + 20));
    } catch (err) {
      setFatal(`No pudimos crear los perfiles: ${err instanceof Error ? err.message : ""}`);
      setPhase("done");
      return;
    }

    // 2. Products in small batches, a few at a time.
    setPhase("rows");
    const batches: Sheet["rows"][] = [];
    for (let i = 0; i < validRows.length; i += BATCH) batches.push(validRows.slice(i, i + BATCH));
    let next = 0;
    const worker = async () => {
      while (next < batches.length && !stop.current) {
        const batch = batches[next++];
        let got: Outcome[];
        try {
          got = (await post("rows", batch)).outcomes;
        } catch (err) {
          const message = `Falló el lote (${err instanceof Error ? err.message : "red"}); vuelve a importar el archivo`;
          got = batch.map((r) => ({ line: r.line, ref: refOf.get(r.line) ?? "", status: "error", message }));
        }
        setOutcomes((o) => [...o, ...got]);
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    setPhase("done");
  }

  const counts = outcomes.reduce<Record<string, number>>(
    (acc, o) => ({ ...acc, [o.status]: (acc[o.status] ?? 0) + 1 }),
    {},
  );
  const failed = outcomes.filter((o) => o.status === "error");

  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-2xl border bg-card p-5 text-sm">
        <h2 className="font-extrabold">1. Archivo</h2>
        <p className="text-muted-foreground">
          CSV con una fila por producto (en Excel: Guardar como → CSV UTF-8). Usa la plantilla: si las columnas ya
          existen con otros nombres comunes (sku, dueño, imágenes…) también las reconocemos. Las fotos son enlaces
          públicos; los de Google Drive deben estar compartidos como &quot;cualquier persona con el enlace&quot;.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-4 py-2 font-bold text-primary-foreground hover:bg-primary-hover">
            <FileUp className="size-4" /> {fileName ? "Cambiar archivo" : "Elegir archivo CSV"}
            <input
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              disabled={running}
              onChange={(e) => onFile(e.target.files?.[0])}
            />
          </label>
          <a
            href={`data:text/csv;charset=utf-8,${encodeURIComponent("﻿" + TEMPLATE_CSV)}`}
            download="plantilla-productos.csv"
            className="inline-flex items-center gap-1.5 font-bold text-primary"
          >
            <Download className="size-4" /> Descargar plantilla
          </a>
          {fileName && <span className="text-muted-foreground">{fileName}</span>}
        </div>
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer font-bold">Valores aceptados</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              <b>categoria:</b> {categories.map((c) => c.name).join(", ")} (o sinónimos como carreola, autoasiento).
            </li>
            <li>
              <b>condicion:</b> nuevo con etiquetas, como nuevo, excelente, bueno, aceptable.
            </li>
            <li>
              <b>edad:</b> RN, 0-3m, 3-6m, 6-12m, 1-2a, 2-4a, 4+, embarazo, todas; varias separadas por coma o un rango
              (&quot;RN a 2-4 años&quot;). No hace falta en muebles, accesorios, etc.
            </li>
            <li>
              <b>precio:</b> en pesos (1500 o $1,500.00). <b>fotos:</b> hasta {maxPhotos} enlaces separados por espacio.
            </li>
            <li>
              <b>vendedor_alias</b> (opcional) es el nombre público; si falta usamos nombre + inicial (&quot;Lucía
              M.&quot;). Correo y teléfono son privados.
            </li>
          </ul>
        </details>
      </section>

      {sheet?.missing.length ? (
        <p role="alert" className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm font-semibold">
          Faltan columnas obligatorias: {sheet.missing.join(", ")}.
        </p>
      ) : (
        sheet && (
          <section className="space-y-3 rounded-2xl border bg-card p-5 text-sm">
            <h2 className="font-extrabold">2. Revisión</h2>
            <p>
              <b>{valid.length.toLocaleString("es-MX")}</b> productos listos de <b>{sellers.toLocaleString("es-MX")}</b>{" "}
              vendedores ({photos.toLocaleString("es-MX")} fotos)
              {invalid.length > 0 && (
                <>
                  {" · "}
                  <b className="text-destructive">{invalid.length.toLocaleString("es-MX")} filas con errores</b> (no se
                  importan)
                </>
              )}
              .
            </p>
            {invalid.length > 0 && (
              <>
                <ul className="max-h-64 divide-y overflow-y-auto rounded-xl border text-xs">
                  {invalid.slice(0, 200).map((r) => (
                    <li key={r.line} className="p-2">
                      <b>
                        Fila {r.line}
                        {r.ref && ` (${r.ref})`}:
                      </b>{" "}
                      {r.errors.join(" · ")}
                    </li>
                  ))}
                </ul>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    downloadCsv("errores-importacion.csv", [
                      ["fila", "id_producto", "errores"],
                      ...invalid.map((r) => [String(r.line), r.ref, r.errors.join(" · ")]),
                    ])
                  }
                >
                  <Download /> Descargar errores
                </Button>
              </>
            )}
          </section>
        )
      )}

      {sheet && !sheet.missing.length && valid.length > 0 && (
        <section className="space-y-4 rounded-2xl border bg-card p-5 text-sm">
          <h2 className="font-extrabold">3. Bodega</h2>
          <p className="text-muted-foreground">
            Dónde están los productos y cómo los entregas. Aplica a todo el archivo.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="city">Ciudad</Label>
              <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} maxLength={80} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="municipality">Alcaldía / municipio</Label>
              <Input id="municipality" value={municipality} onChange={(e) => setMunicipality(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="state">Estado</Label>
              <Input id="state" value={state} onChange={(e) => setState(e.target.value)} />
            </div>
          </div>
          <fieldset className="flex flex-wrap gap-4">
            <legend className="mb-2 font-bold">Entrega</legend>
            {keysOf(DELIVERY_METHODS).map((m) => (
              <label key={m} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={delivery.includes(m)}
                  onChange={(e) => setDelivery(e.target.checked ? [...delivery, m] : delivery.filter((x) => x !== m))}
                  className="size-4 accent-primary"
                />
                {m === "pickup" ? "Recoger en bodega" : DELIVERY_METHODS[m]}
              </label>
            ))}
          </fieldset>
          {delivery.includes("shipping") && (
            <div className="max-w-xs space-y-1.5">
              <Label htmlFor="shipping">Costo de envío (MXN, 0 = incluido)</Label>
              <Input
                id="shipping"
                inputMode="decimal"
                value={shippingPrice}
                onChange={(e) => setShippingPrice(e.target.value)}
              />
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Button size="lg" disabled={!warehouseValid || running} onClick={run}>
              {running ? "Importando…" : `Importar ${valid.length.toLocaleString("es-MX")} productos`}
            </Button>
            {running && (
              <Button variant="outline" onClick={() => (stop.current = true)}>
                Detener
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Puedes volver a importar el mismo archivo cuando quieras: los productos ya importados se actualizan y no se
            duplican; las fotos solo se vuelven a descargar si cambian sus enlaces.
          </p>
        </section>
      )}

      {phase !== "idle" && (
        <section aria-live="polite" className="space-y-3 rounded-2xl border bg-card p-5 text-sm">
          <h2 className="font-extrabold">{phase === "done" ? "Resultado" : "Progreso"}</h2>
          {phase === "sellers" && <p>Creando perfiles de vendedores…</p>}
          {fatal && <p className="font-semibold text-destructive">{fatal}</p>}
          {phase !== "sellers" && (
            <>
              <div
                role="progressbar"
                aria-label="Progreso de la importación"
                aria-valuemin={0}
                aria-valuemax={valid.length}
                aria-valuenow={outcomes.length}
                className="h-2.5 overflow-hidden rounded-full bg-muted"
              >
                <div
                  className="h-full rounded-full bg-primary transition-[width]"
                  style={{ width: `${valid.length ? (outcomes.length / valid.length) * 100 : 0}%` }}
                />
              </div>
              <p>
                {outcomes.length.toLocaleString("es-MX")} de {valid.length.toLocaleString("es-MX")}
              </p>
              <ul className="flex flex-wrap gap-x-4 gap-y-1">
                {(Object.keys(STATUS_LABELS) as Outcome["status"][])
                  .filter((s) => counts[s])
                  .map((s) => (
                    <li key={s} data-status={s}>
                      {STATUS_LABELS[s]}: <b>{counts[s].toLocaleString("es-MX")}</b>
                    </li>
                  ))}
              </ul>
            </>
          )}
          {phase === "done" && failed.length > 0 && (
            <>
              <ul className="max-h-64 divide-y overflow-y-auto rounded-xl border text-xs">
                {failed.slice(0, 200).map((o) => (
                  <li key={o.line} className="p-2">
                    <b>
                      Fila {o.line} ({o.ref}):
                    </b>{" "}
                    {o.message}
                  </li>
                ))}
              </ul>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  downloadCsv("resultado-importacion.csv", [
                    ["fila", "id_producto", "resultado", "detalle"],
                    ...outcomes.map((o) => [String(o.line), o.ref, STATUS_LABELS[o.status], o.message ?? ""]),
                  ])
                }
              >
                <Download /> Descargar resultado
              </Button>
            </>
          )}
        </section>
      )}
    </div>
  );
}
