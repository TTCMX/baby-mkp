import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { AGE_STAGES, keysOf } from "@/lib/domain/constants";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { CategoryIcon } from "@/features/catalog/category-icon";
import { ListingCard } from "@/features/catalog/listing-card";
import { FamilyHome, type BabyView } from "@/features/babies/family-home";
import { getMyBabies, type Baby } from "@/features/babies/queries";
import { ageLabel, currentStage, headline, outgrownStage, timeline, todayInMexico } from "@/features/babies/stages";
import {
  getListingsForStages,
  getLatestListings,
  getListingsNear,
  getPopularListings,
  getTopLevelCategories,
  type ListingCardData,
} from "@/features/catalog/queries";

// Stage chips cycle through the brand washes (decorative, not an encoding).
const STAGE_TONES = ["bg-pink-wash", "bg-sky-wash", "bg-sun-wash"];

export default async function HomePage() {
  const user = await getCurrentUser();
  const city = user?.profile.city ?? null;
  const [categories, latest, popular, near, babies] = await Promise.all([
    getTopLevelCategories(),
    getLatestListings(10),
    getPopularListings(5),
    city ? getListingsNear(city, 5) : Promise.resolve([]),
    user ? getMyBabies() : Promise.resolve([] as Baby[]),
  ]);
  const family = babies.length ? await buildFamily(babies) : null;

  return (
    <div className="flex flex-col gap-8 md:gap-10">
      {family ? (
        <FamilyHome parentName={user!.profile.display_name} babies={family.views} feeds={family.feeds} />
      ) : (
        <>
          <HomeHero name={user?.profile.display_name ?? null} />
          <GrowInvite signedIn={Boolean(user)} />
        </>
      )}

      <section aria-labelledby="stages-heading" className="flex flex-col gap-3">
        <h2 id="stages-heading" className="text-[22px] font-semibold md:text-[26px]">
          Compra por etapa
        </h2>
        <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0">
          {keysOf(AGE_STAGES)
            .filter((a) => a !== "all_ages")
            .map((a, i) => (
              <li key={a} className="shrink-0">
                <Link
                  href={`/search?age=${a}`}
                  className={cn(
                    "inline-flex h-11 items-center rounded-full px-5 text-sm font-extrabold transition-colors hover:brightness-95",
                    STAGE_TONES[i % STAGE_TONES.length],
                  )}
                >
                  {AGE_STAGES[a]}
                </Link>
              </li>
            ))}
        </ul>
      </section>

      <section aria-labelledby="categories-heading" className="flex flex-col gap-3">
        <h2 id="categories-heading" className="text-[22px] font-semibold md:text-[26px]">
          Categorías
        </h2>
        <ul className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-5 md:px-0">
          {categories.map((c) => (
            <li key={c.id} className="shrink-0">
              <Link
                href={`/category/${c.slug}`}
                className="flex w-20 flex-col items-center gap-1.5 text-center text-xs font-bold md:w-auto md:flex-row md:gap-3 md:rounded-[22px] md:border-[1.5px] md:bg-card md:p-3 md:text-left md:text-sm md:hover:border-sky-soft"
              >
                <span className="flex size-14 items-center justify-center rounded-2xl bg-sky-wash md:size-11">
                  <CategoryIcon icon={c.icon} className="size-6 text-primary md:size-5" />
                </span>
                <span className="leading-tight">{c.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {latest.length === 0 ? (
        <div className="rounded-[22px] border-[1.5px] border-dashed p-8 text-center text-sm text-muted-foreground">
          Aún no hay productos publicados.{" "}
          <Link href="/sell/new" className="font-semibold text-primary">
            ¡Sé la primera persona en vender!
          </Link>
        </div>
      ) : (
        <>
          <ListingSection title="Nuevos" href="/search" listings={latest} />
          {near.length > 0 && city && (
            <ListingSection
              title={`Cerca de ti · ${city}`}
              href={`/search?city=${encodeURIComponent(city)}`}
              listings={near}
            />
          )}
          {popular.length > 0 && <ListingSection title="Populares" href="/search?sort=popular" listings={popular} />}
        </>
      )}
    </div>
  );
}

function ListingSection({ title, href, listings }: { title: string; href: string; listings: ListingCardData[] }) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-[22px] font-semibold md:text-[26px]">{title}</h2>
        <Link href={href} className="inline-flex shrink-0 items-center text-sm font-extrabold text-primary">
          Ver todo <ChevronRight className="size-4" />
        </Link>
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-[18px] lg:grid-cols-5">
        {listings.map((listing) => (
          <li key={listing.id}>
            <ListingCard listing={listing} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function HomeHero({ name }: { name: string | null }) {
  return (
    <section className="flex flex-col gap-5 rounded-[32px] border-[1.5px] bg-card px-5 py-6 md:flex-row md:items-center md:gap-8 md:px-10 md:py-9">
      {/* eslint-disable-next-line @next/next/no-img-element -- static brand art, sized in CSS */}
      <img
        src="/brand/mascot.png"
        alt=""
        width={132}
        height={121}
        className="h-[73px] w-20 shrink-0 md:h-[121px] md:w-[132px]"
      />
      <div className="flex flex-1 flex-col gap-2">
        {name && <p className="text-sm font-extrabold text-pink-ink">Hola, {name}</p>}
        <h1 className="text-pretty text-[28px] font-bold leading-[1.1] md:text-[40px]">
          Lo que tu bebé ya no usa, otra familia lo necesita
        </h1>
        <p className="max-w-xl text-[15px] text-muted-foreground">
          Compra de segunda mano con confianza y vende lo que ya les queda chico en un par de minutos.
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2 md:flex-col">
        <Link
          href="/sell/new"
          className={cn(
            buttonVariants(),
            "h-11 bg-pink px-6 text-[15px] font-extrabold text-foreground hover:bg-pink/90",
          )}
        >
          Vender algo
        </Link>
        <Link
          href="/search"
          className={cn(buttonVariants({ variant: "outline" }), "h-11 px-6 text-[15px] font-extrabold")}
        >
          Explorar
        </Link>
      </div>
    </section>
  );
}

/** Invitation to "Crece con tus bebés" for visitors and parents without babies yet. */
function GrowInvite({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="flex flex-col gap-4 rounded-[22px] bg-sky-wash px-6 py-5 sm:flex-row sm:items-center">
      <div className="flex-1">
        <h2 className="text-[20px] font-semibold">Crece con tus bebés</h2>
        <p className="text-[15px] text-[#3a4a66]">
          Agrega a tu bebé y te mostramos lo de su etapa, lo que viene y cuándo vender lo que ya le queda chico.
        </p>
      </div>
      <Link
        href={signedIn ? "/babies" : "/signup?next=/babies"}
        className="flex h-11 shrink-0 items-center justify-center rounded-full bg-primary px-5 font-extrabold text-primary-foreground hover:bg-primary/90"
      >
        Agregar a mi bebé
      </Link>
    </section>
  );
}

async function buildFamily(babies: Baby[]) {
  const today = todayInMexico();
  const views: BabyView[] = babies.map((b) => {
    const stage = currentStage(b, today);
    const out = outgrownStage(b, today);
    return {
      id: b.id,
      name: b.name,
      color: b.color,
      ageLabel: ageLabel(b, today),
      headline: headline(b.name, b, today),
      timeline: timeline(b, today),
      currentStage: stage,
      currentLabel: AGE_STAGES[stage],
      outgrown: out ? { stage: out, label: AGE_STAGES[out] } : null,
    };
  });
  // Products for each baby's current stage (plus "all ages").
  const lists = await Promise.all(views.map((v) => getListingsForStages([v.currentStage, "all_ages"], 10)));
  const feeds = Object.fromEntries(
    views.map((v, i) => [
      v.id,
      lists[i].length === 0 ? (
        <div className="rounded-[22px] border-[1.5px] border-dashed p-8 text-center text-sm text-muted-foreground">
          Aún no hay productos para {v.currentLabel}.{" "}
          <Link href="/sell/new" className="font-semibold text-primary">
            ¡Sé la primera persona en vender!
          </Link>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-[18px] lg:grid-cols-5">
          {lists[i].map((listing) => (
            <li key={listing.id}>
              <ListingCard listing={listing} />
            </li>
          ))}
        </ul>
      ),
    ]),
  );
  return { views, feeds };
}
