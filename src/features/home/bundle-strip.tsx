import { formatPrice } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { Bundle } from "./demo-data";

const TINTS: Record<Bundle["tint"], { card: string; back: string }> = {
  sky: { card: "bg-sky-wash", back: "bg-sky-soft" },
  pink: { card: "bg-pink-wash", back: "bg-pink-soft" },
  sun: { card: "bg-sun-wash", back: "bg-sun-soft" },
};

/** Row of bundle ("lote") teasers with a stacked-photo thumbnail. */
export function BundleStrip({ bundles }: { bundles: Bundle[] }) {
  return (
    <section aria-label="Lotes">
      <ul className="grid gap-[18px] md:grid-cols-3">
        {bundles.map((b) => {
          const tint = TINTS[b.tint];
          return (
            <li key={b.id} className={cn("flex items-center gap-[18px] rounded-[26px] p-[22px]", tint.card)}>
              <div className="relative size-24 shrink-0" aria-hidden>
                <div
                  className={cn(
                    "absolute inset-[10px_0_0_10px] rotate-[8deg] rounded-2xl bg-cover bg-center",
                    tint.back,
                  )}
                  style={{ backgroundImage: `url(${b.images[1]})` }}
                />
                <div
                  className="absolute inset-[0_10px_10px_0] flex items-end justify-end rounded-2xl bg-card bg-cover bg-center p-1.5"
                  style={{ backgroundImage: `url(${b.images[0]})` }}
                >
                  <span className="rounded-full bg-card px-[9px] py-0.5 font-display text-[15px] font-bold">
                    {b.count}
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-[3px]">
                <span className="text-[13px] font-extrabold text-[#46506a]">
                  Lote · {b.size}
                  <span className="sr-only"> · {b.count} prendas</span>
                </span>
                <span className="font-display text-[19px] font-semibold leading-[1.2]">{b.title}</span>
                <span className="text-base font-extrabold">
                  {formatPrice(b.priceCents)} · ahorras {b.savePercent}%
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
