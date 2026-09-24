import { MapPin, Package, Star, Truck, UserRound } from "lucide-react";
import {
  AGE_STAGES,
  DELIVERY_METHODS,
  LISTING_CONDITIONS,
  type AgeStage,
  type DeliveryMethod,
  type ListingCondition,
} from "@/lib/domain/constants";
import { formatPrice } from "@/lib/money";
import { ListingGallery, type GalleryImage } from "./listing-gallery";

export type ListingViewData = {
  title: string;
  description: string;
  priceCents: number;
  currency?: string;
  condition: ListingCondition;
  brand: string | null;
  model: string | null;
  ageStages: AgeStage[];
  categoryName: string | null;
  isBundle: boolean;
  bundleItemCount: number | null;
  city: string;
  municipality: string | null;
  deliveryMethods: DeliveryMethod[];
  shippingPriceCents: number | null;
  images: GalleryImage[];
  seller: {
    displayName: string;
    avatarUrl: string | null;
    salesCount: number;
    ratingAvg: number | null;
    ratingCount: number;
    activeListings: number;
  };
};

/**
 * The product page body. Used by /listing/[id] and by the sell wizard preview,
 * so sellers see exactly what buyers will see. `actions` renders the CTA area.
 */
export function ListingView({ data, actions }: { data: ListingViewData; actions?: React.ReactNode }) {
  const location = [data.municipality, data.city].filter(Boolean).join(", ");
  const brandModel = [data.brand, data.model].filter(Boolean).join(" ");

  return (
    <article className="grid gap-6 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:gap-10">
      <ListingGallery images={data.images} alt={data.title} />

      <div className="space-y-5">
        <header className="space-y-1">
          {data.categoryName && (
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{data.categoryName}</p>
          )}
          <h1 className="text-2xl font-extrabold leading-tight">{data.title}</h1>
          <p className="text-3xl font-extrabold text-primary">{formatPrice(data.priceCents, data.currency)}</p>
        </header>

        <ul className="flex flex-wrap gap-2 text-sm">
          <Chip strong>{LISTING_CONDITIONS[data.condition].label}</Chip>
          {data.isBundle && data.bundleItemCount && <Chip>Lote · {data.bundleItemCount} piezas</Chip>}
          {data.ageStages.map((s) => (
            <Chip key={s}>{AGE_STAGES[s]}</Chip>
          ))}
        </ul>

        {actions}

        <dl className="divide-y rounded-2xl border bg-card text-sm">
          {brandModel && <Row label="Marca y modelo" value={brandModel} />}
          <Row
            label="Condición"
            value={`${LISTING_CONDITIONS[data.condition].label} — ${LISTING_CONDITIONS[data.condition].hint}`}
          />
          <Row
            label={
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-4" /> Ubicación
              </span>
            }
            value={location}
          />
          <Row
            label={
              <span className="inline-flex items-center gap-1.5">
                <Truck className="size-4" /> Entrega
              </span>
            }
            value={
              <ul className="space-y-0.5 text-right">
                {data.deliveryMethods.map((m) => (
                  <li key={m}>
                    {DELIVERY_METHODS[m]}
                    {m === "shipping" &&
                      (data.shippingPriceCents ? ` · ${formatPrice(data.shippingPriceCents)}` : " · por acordar")}
                  </li>
                ))}
              </ul>
            }
          />
        </dl>

        {data.description && (
          <section>
            <h2 className="mb-1.5 font-extrabold">Descripción</h2>
            <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">{data.description}</p>
          </section>
        )}

        <section className="flex items-center gap-3 rounded-2xl border bg-card p-4">
          {data.seller.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.seller.avatarUrl} alt="" className="size-12 rounded-full object-cover" />
          ) : (
            <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
              <UserRound className="size-6" />
            </span>
          )}
          <div className="min-w-0 text-sm">
            <p className="truncate font-extrabold">{data.seller.displayName}</p>
            <p className="flex flex-wrap items-center gap-x-2 text-muted-foreground">
              {data.seller.ratingCount > 0 ? (
                <span className="inline-flex items-center gap-0.5">
                  <Star className="size-3.5 fill-current text-primary" />
                  {Number(data.seller.ratingAvg).toFixed(1)} ({data.seller.ratingCount})
                </span>
              ) : (
                <span>Sin reseñas aún</span>
              )}
              <span>· {data.seller.salesCount} ventas</span>
              <span className="inline-flex items-center gap-0.5">
                · <Package className="size-3.5" /> {data.seller.activeListings} en venta
              </span>
            </p>
          </div>
        </section>
      </div>
    </article>
  );
}

function Chip({ children, strong }: { children: React.ReactNode; strong?: boolean }) {
  return (
    <li
      className={
        strong
          ? "rounded-full bg-accent px-3 py-1 font-bold text-accent-foreground"
          : "rounded-full bg-secondary px-3 py-1 font-semibold text-secondary-foreground"
      }
    >
      {children}
    </li>
  );
}

function Row({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="text-right font-semibold">{value}</dd>
    </div>
  );
}
