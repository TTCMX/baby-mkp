"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CategoryIcon } from "@/features/catalog/category-icon";
import {
  AGE_STAGES,
  DELIVERY_METHODS,
  LISTING_CONDITIONS,
  keysOf,
  type AgeStage,
  type DeliveryMethod,
  type ListingCondition,
} from "@/lib/domain/constants";
import { processImage } from "@/lib/images";
import { formatPrice, parsePriceToCents } from "@/lib/money";
import { LISTING_IMAGES_BUCKET, listingFolder, listingPhotoUrl, thumbPath } from "@/lib/storage";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { saveListing } from "../actions";
import { ListingView, type ListingViewData } from "../listing-view";
import { listingInputSchema, MIN_PRICE_CENTS, type ListingInput } from "../schema";
import { PhotosStep, type WizardPhoto } from "./photos-step";

export type WizardCategory = { id: string; name: string; icon: string | null; allows_shipping: boolean };

export type WizardFields = {
  title: string;
  description: string;
  categoryId: string;
  brand: string;
  model: string;
  condition: ListingCondition | "";
  ageStages: AgeStage[];
  isBundle: boolean;
  bundleItemCount: string;
  price: string;
  city: string;
  municipality: string;
  deliveryMethods: DeliveryMethod[];
  shippingPrice: string;
};

type Props = {
  userId: string;
  listingId: string;
  mode: "new" | "edit";
  initialFields: WizardFields;
  initialPhotos: { path: string; width: number | null; height: number | null }[];
  categories: WizardCategory[];
  brands: string[];
  maxImages: number;
  seller: ListingViewData["seller"];
};

const STEPS = ["Fotos", "Detalles", "Descripción", "Entrega", "Vista previa"] as const;

type Errors = Partial<Record<string, string>>;

export function SellWizard(props: Props) {
  const { userId, listingId, mode, categories, brands, maxImages, seller } = props;
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [fields, setFields] = useState<WizardFields>(props.initialFields);
  const [photos, setPhotos] = useState<WizardPhoto[]>(() =>
    props.initialPhotos.map((p) => ({
      key: p.path,
      path: p.path,
      previewUrl: listingPhotoUrl(p.path, "thumb"),
      status: "done",
      width: p.width,
      height: p.height,
      saved: true,
    })),
  );
  const [errors, setErrors] = useState<Errors>({});
  const [saving, startSaving] = useTransition();
  const top = useRef<HTMLDivElement>(null);
  const [supabase] = useState(createClient);

  const category = categories.find((c) => c.id === fields.categoryId);
  // Form fields whose validation error is reported under a different key.
  const ERROR_KEY: Partial<Record<keyof WizardFields, string>> = {
    price: "priceCents",
    shippingPrice: "shippingPriceCents",
  };
  const set = <K extends keyof WizardFields>(key: K, value: WizardFields[K]) => {
    setFields((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [ERROR_KEY[key] ?? key]: undefined }));
  };

  // Big items: shipping is not offered for categories that don't allow it.
  function selectCategory(c: WizardCategory) {
    setFields((f) => ({
      ...f,
      categoryId: c.id,
      deliveryMethods: c.allows_shipping ? f.deliveryMethods : f.deliveryMethods.filter((m) => m !== "shipping"),
    }));
    setErrors((e) => ({ ...e, categoryId: undefined }));
  }

  // ---------------------------------------------------------------- photos
  async function uploadPhoto(file: File, key: string) {
    try {
      const img = await processImage(file);
      const path = `${listingFolder(userId, listingId)}${crypto.randomUUID()}.${img.ext}`;
      const contentType = img.ext === "webp" ? "image/webp" : "image/jpeg";
      const bucket = supabase.storage.from(LISTING_IMAGES_BUCKET);
      const [full, thumb] = await Promise.all([
        bucket.upload(path, img.full, { contentType, cacheControl: "31536000" }),
        bucket.upload(thumbPath(path), img.thumb, { contentType, cacheControl: "31536000" }),
      ]);
      if (full.error || thumb.error) throw full.error ?? thumb.error;
      setPhotos((ps) =>
        ps.map((p) => (p.key === key ? { ...p, path, status: "done", width: img.width, height: img.height } : p)),
      );
    } catch (err) {
      console.error("[sell] photo upload failed", err);
      setPhotos((ps) => ps.map((p) => (p.key === key ? { ...p, status: "error" } : p)));
    }
  }

  function addPhotos(files: File[]) {
    const added: WizardPhoto[] = files.map((file) => ({
      key: crypto.randomUUID(),
      previewUrl: URL.createObjectURL(file),
      status: "uploading",
      width: null,
      height: null,
      saved: false,
    }));
    setPhotos((ps) => [...ps, ...added].slice(0, maxImages));
    setErrors((e) => ({ ...e, images: undefined }));
    added.forEach((p, i) => void uploadPhoto(files[i], p.key));
  }

  function removePhoto(key: string) {
    const photo = photos.find((p) => p.key === key);
    setPhotos((ps) => ps.filter((p) => p.key !== key));
    if (!photo) return;
    if (photo.previewUrl.startsWith("blob:")) URL.revokeObjectURL(photo.previewUrl);
    // New uploads are discarded right away; saved photos are removed on save.
    if (!photo.saved && photo.path) {
      void supabase.storage.from(LISTING_IMAGES_BUCKET).remove([photo.path, thumbPath(photo.path)]);
    }
  }

  function movePhoto(key: string, to: number) {
    setPhotos((ps) => {
      const from = ps.findIndex((p) => p.key === key);
      if (from < 0 || to < 0 || to >= ps.length) return ps;
      const next = [...ps];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }

  // ------------------------------------------------------------ validation
  function toInput(): ListingInput {
    const bundleCount = Number.parseInt(fields.bundleItemCount, 10);
    return {
      id: listingId,
      title: fields.title,
      description: fields.description,
      categoryId: fields.categoryId,
      brand: fields.brand,
      model: fields.model,
      condition: fields.condition as ListingCondition,
      ageStages: fields.ageStages,
      isBundle: fields.isBundle,
      bundleItemCount: fields.isBundle && Number.isFinite(bundleCount) ? bundleCount : null,
      priceCents: parsePriceToCents(fields.price) ?? Number.NaN,
      city: fields.city,
      municipality: fields.municipality,
      deliveryMethods: fields.deliveryMethods,
      shippingPriceCents: fields.shippingPrice ? parsePriceToCents(fields.shippingPrice) : null,
      images: photos
        .filter((p) => p.status === "done" && p.path)
        .map((p) => ({ storage_path: p.path!, width: p.width, height: p.height })),
    };
  }

  const STEP_FIELDS: string[][] = [
    ["images"],
    ["title", "categoryId", "condition", "ageStages", "priceCents", "bundleItemCount"],
    ["description"],
    ["city", "municipality", "deliveryMethods", "shippingPriceCents"],
    [],
  ];

  function validate(upTo: number): Errors {
    const found: Errors = {};
    if (photos.some((p) => p.status === "uploading")) found.images = "Espera a que terminen de subir tus fotos";
    else if (photos.some((p) => p.status === "error")) found.images = "Quita las fotos que no se pudieron subir";

    const parsed = listingInputSchema.safeParse(toInput());
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        found[String(issue.path[0])] ??= issue.message;
      }
    }
    const relevant = STEP_FIELDS.slice(0, upTo + 1).flat();
    return Object.fromEntries(Object.entries(found).filter(([k]) => relevant.includes(k)));
  }

  function firstStepWithError(errs: Errors) {
    return STEP_FIELDS.findIndex((keys) => keys.some((k) => errs[k]));
  }

  function goTo(next: number) {
    setStep(next);
    top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function next() {
    const errs = validate(step);
    setErrors(errs);
    if (Object.keys(errs).length === 0) goTo(step + 1);
  }

  function submit(intent: "draft" | "publish") {
    const errs = validate(STEPS.length - 1);
    if (Object.keys(errs).length) {
      setErrors(errs);
      goTo(Math.max(0, firstStepWithError(errs)));
      return;
    }
    startSaving(async () => {
      const result = await saveListing(toInput(), intent);
      if (!result.ok) {
        const fieldErrors = result.fieldErrors ?? {};
        setErrors({ ...fieldErrors, form: result.error });
        const stepWithError = firstStepWithError(fieldErrors);
        if (stepWithError >= 0) goTo(stepWithError);
        return;
      }
      setPhotos((ps) => ps.map((p) => ({ ...p, saved: true })));
      if (result.status === "active") router.push(`/listing/${result.id}?published=1`);
      else router.push(`/sell?saved=${result.status}`);
    });
  }

  // --------------------------------------------------------------- preview
  const previewData: ListingViewData = {
    title: fields.title || "Tu producto",
    description: fields.description,
    priceCents: parsePriceToCents(fields.price) ?? 0,
    condition: (fields.condition || "good") as ListingCondition,
    brand: fields.brand || null,
    model: fields.model || null,
    ageStages: fields.ageStages,
    categoryName: category?.name ?? null,
    isBundle: fields.isBundle,
    bundleItemCount: Number.parseInt(fields.bundleItemCount, 10) || null,
    city: fields.city,
    municipality: fields.municipality || null,
    deliveryMethods: fields.deliveryMethods,
    shippingPriceCents: fields.shippingPrice ? parsePriceToCents(fields.shippingPrice) : null,
    images: photos
      .filter((p) => p.status === "done")
      .map((p) => ({
        src: p.saved && p.path ? listingPhotoUrl(p.path) : p.previewUrl,
        thumb: p.previewUrl,
        width: p.width,
        height: p.height,
      })),
    seller,
  };

  const isLast = step === STEPS.length - 1;

  return (
    <div ref={top} className="mx-auto max-w-3xl scroll-mt-20">
      <div className="mb-5 space-y-2">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          {mode === "new" ? "Vender" : "Editar producto"} · Paso {step + 1} de {STEPS.length} · {STEPS[step]}
        </p>
        <div className="flex gap-1.5" aria-hidden>
          {STEPS.map((s, i) => (
            <span key={s} className={cn("h-1.5 flex-1 rounded-full", i <= step ? "bg-primary" : "bg-muted")} />
          ))}
        </div>
      </div>

      <div className="min-h-[50vh]">
        {step === 0 && (
          <PhotosStep
            photos={photos}
            maxImages={maxImages}
            onAdd={addPhotos}
            onRemove={removePhoto}
            onMove={movePhoto}
            error={errors.images}
          />
        )}

        {step === 1 && (
          <div className="space-y-6">
            <h2 className="text-xl font-extrabold">Cuéntanos qué vendes</h2>

            <Field label="¿Qué vendes?" htmlFor="title" error={errors.title}>
              <Input
                id="title"
                value={fields.title}
                maxLength={90}
                placeholder="Ej. Carriola Nuna Mixx 2024"
                onChange={(e) => set("title", e.target.value)}
                aria-invalid={!!errors.title}
              />
            </Field>

            <Field label="Categoría" error={errors.categoryId}>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {categories.map((c) => (
                  <Choice key={c.id} selected={fields.categoryId === c.id} onClick={() => selectCategory(c)}>
                    <CategoryIcon icon={c.icon} className="size-5 shrink-0 text-primary" />
                    <span className="leading-tight">{c.name}</span>
                  </Choice>
                ))}
              </div>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Marca (opcional)" htmlFor="brand">
                <Input
                  id="brand"
                  list="brand-options"
                  value={fields.brand}
                  maxLength={60}
                  placeholder="Ej. Nuna"
                  autoComplete="off"
                  onChange={(e) => set("brand", e.target.value)}
                />
                <datalist id="brand-options">
                  {brands.map((b) => (
                    <option key={b} value={b} />
                  ))}
                </datalist>
              </Field>
              <Field label="Modelo (opcional)" htmlFor="model">
                <Input
                  id="model"
                  value={fields.model}
                  maxLength={80}
                  placeholder="Ej. Mixx"
                  onChange={(e) => set("model", e.target.value)}
                />
              </Field>
            </div>

            <Field label="Condición" error={errors.condition}>
              <div className="grid gap-2">
                {keysOf(LISTING_CONDITIONS).map((c) => (
                  <Choice key={c} selected={fields.condition === c} onClick={() => set("condition", c)}>
                    <span>
                      <span className="block">{LISTING_CONDITIONS[c].label}</span>
                      <span className="block text-xs font-normal text-muted-foreground">
                        {LISTING_CONDITIONS[c].hint}
                      </span>
                    </span>
                  </Choice>
                ))}
              </div>
            </Field>

            <Field label="Edad o etapa (elige todas las que apliquen)" error={errors.ageStages}>
              <div className="flex flex-wrap gap-2">
                {keysOf(AGE_STAGES).map((a) => {
                  const selected = fields.ageStages.includes(a);
                  return (
                    <Pill
                      key={a}
                      selected={selected}
                      onClick={() =>
                        set("ageStages", selected ? fields.ageStages.filter((x) => x !== a) : [...fields.ageStages, a])
                      }
                    >
                      {AGE_STAGES[a]}
                    </Pill>
                  );
                })}
              </div>
            </Field>

            <Field label="Precio" htmlFor="price" error={errors.priceCents}>
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">
                  $
                </span>
                <Input
                  id="price"
                  inputMode="decimal"
                  value={fields.price}
                  placeholder="0"
                  className="pl-8 text-lg font-bold"
                  onChange={(e) => set("price", e.target.value)}
                  aria-invalid={!!errors.priceCents}
                />
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  MXN
                </span>
              </div>
              <p className="text-xs text-muted-foreground">Mínimo {formatPrice(MIN_PRICE_CENTS)}.</p>
            </Field>

            <div className="space-y-3 rounded-2xl border bg-card p-4">
              <label className="flex items-center justify-between gap-3 font-semibold">
                <span>
                  ¿Es un lote?
                  <span className="block text-xs font-normal text-muted-foreground">
                    Varias piezas en una sola venta, ej. 20 prendas de 0–3 meses
                  </span>
                </span>
                <input
                  type="checkbox"
                  className="size-5 accent-[var(--primary)]"
                  checked={fields.isBundle}
                  onChange={(e) => set("isBundle", e.target.checked)}
                />
              </label>
              {fields.isBundle && (
                <Field label="¿Cuántas piezas?" htmlFor="bundleItemCount" error={errors.bundleItemCount}>
                  <Input
                    id="bundleItemCount"
                    inputMode="numeric"
                    value={fields.bundleItemCount}
                    onChange={(e) => set("bundleItemCount", e.target.value.replace(/\D/g, ""))}
                  />
                </Field>
              )}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-extrabold">Descríbelo</h2>
              <p className="text-sm text-muted-foreground">
                Cuánto tiempo lo usaron, qué incluye, si tiene algún detalle. La honestidad genera confianza.
              </p>
            </div>
            <Field label="Descripción (opcional)" htmlFor="description" error={errors.description}>
              <Textarea
                id="description"
                rows={8}
                maxLength={4000}
                value={fields.description}
                placeholder="Ej. La usamos 8 meses, está en excelente estado. Tiene un rayón pequeño en la base. Incluye cubierta para lluvia."
                onChange={(e) => set("description", e.target.value)}
              />
              <p className="text-right text-xs text-muted-foreground">{fields.description.length} / 4000</p>
            </Field>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-extrabold">¿Dónde está y cómo lo entregas?</h2>
              <p className="text-sm text-muted-foreground">Solo mostramos la zona aproximada, nunca tu dirección.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Ciudad" htmlFor="city" error={errors.city}>
                <Input
                  id="city"
                  value={fields.city}
                  maxLength={80}
                  placeholder="Ej. Ciudad de México"
                  autoComplete="address-level2"
                  onChange={(e) => set("city", e.target.value)}
                  aria-invalid={!!errors.city}
                />
              </Field>
              <Field label="Alcaldía o municipio (opcional)" htmlFor="municipality">
                <Input
                  id="municipality"
                  value={fields.municipality}
                  maxLength={80}
                  placeholder="Ej. Coyoacán"
                  onChange={(e) => set("municipality", e.target.value)}
                />
              </Field>
            </div>

            <Field label="Formas de entrega" error={errors.deliveryMethods}>
              <div className="grid gap-2">
                {keysOf(DELIVERY_METHODS).map((m) => {
                  const disabled = m === "shipping" && category && !category.allows_shipping;
                  const selected = fields.deliveryMethods.includes(m);
                  return (
                    <Choice
                      key={m}
                      selected={selected}
                      disabled={!!disabled}
                      onClick={() =>
                        set(
                          "deliveryMethods",
                          selected ? fields.deliveryMethods.filter((x) => x !== m) : [...fields.deliveryMethods, m],
                        )
                      }
                    >
                      <span>
                        <span className="block">{DELIVERY_METHODS[m]}</span>
                        {disabled && (
                          <span className="block text-xs font-normal text-muted-foreground">
                            No disponible para {category?.name.toLowerCase()} por su tamaño
                          </span>
                        )}
                      </span>
                    </Choice>
                  );
                })}
              </div>
            </Field>

            {fields.deliveryMethods.includes("shipping") && (
              <Field label="Costo de envío (opcional)" htmlFor="shippingPrice" error={errors.shippingPriceCents}>
                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">
                    $
                  </span>
                  <Input
                    id="shippingPrice"
                    inputMode="decimal"
                    className="pl-8"
                    value={fields.shippingPrice}
                    placeholder="Déjalo vacío si el envío va incluido en el precio"
                    onChange={(e) => set("shippingPrice", e.target.value)}
                  />
                </div>
              </Field>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-accent p-4 text-sm font-semibold text-accent-foreground">
              Así verán tu producto los compradores. Revisa que todo esté bien.
            </div>
            <ListingView data={previewData} />
          </div>
        )}
      </div>

      {errors.form && (
        <p role="alert" className="mt-4 text-sm font-semibold text-destructive">
          {errors.form}
        </p>
      )}

      <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 -mx-4 mt-6 flex items-center gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur md:bottom-0 md:mx-0 md:rounded-2xl md:border">
        {step > 0 && (
          <Button type="button" variant="ghost" onClick={() => goTo(step - 1)} disabled={saving}>
            <ArrowLeft /> Atrás
          </Button>
        )}
        <div className="ml-auto flex gap-2">
          {isLast ? (
            <>
              <Button type="button" variant="outline" onClick={() => submit("draft")} disabled={saving}>
                Guardar borrador
              </Button>
              <Button type="button" onClick={() => submit("publish")} disabled={saving}>
                <Check /> {saving ? "Publicando…" : "Publicar"}
              </Button>
            </>
          ) : (
            <Button type="button" onClick={next} className="min-w-32">
              Siguiente
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      {htmlFor ? <Label htmlFor={htmlFor}>{label}</Label> : <p className="text-sm font-semibold">{label}</p>}
      {children}
      {error && (
        <p role="alert" className="text-sm font-semibold text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function Choice({
  selected,
  children,
  ...props
}: { selected: boolean } & Omit<React.ComponentProps<"button">, "type">) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "flex min-h-12 items-center gap-2.5 rounded-xl border bg-card px-3.5 py-2.5 text-left text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        selected ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "hover:bg-muted",
      )}
      {...props}
    >
      {children}
    </button>
  );
}

function Pill({ selected, children, ...props }: { selected: boolean } & Omit<React.ComponentProps<"button">, "type">) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "rounded-full border px-3.5 py-2 text-sm font-semibold transition-colors",
        selected ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted",
      )}
      {...props}
    >
      {children}
    </button>
  );
}
