import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MapPin, Star, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SITE_NAME } from "@/lib/site";
import { cn } from "@/lib/utils";
import { ListingCard } from "@/features/catalog/listing-card";
import type { ListingCardData } from "@/features/catalog/queries";
import type { Profile } from "@/lib/domain/types";

const PUBLIC_COLUMNS =
  "id, username, display_name, avatar_url, bio, city, municipality, sales_count, rating_avg, rating_count, created_at";

async function load(username: string) {
  if (!/^[a-z0-9_]{3,30}$/.test(username)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select(PUBLIC_COLUMNS).eq("username", username).maybeSingle();
  return data as Omit<Profile, "role" | "status"> | null;
}

export async function generateMetadata({ params }: PageProps<"/profile/[username]">): Promise<Metadata> {
  const profile = await load((await params).username);
  return { title: profile ? `${profile.display_name} (@${profile.username})` : "Perfil" };
}

const monthFmt = new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric" });

export default async function ProfilePage({ params }: PageProps<"/profile/[username]">) {
  const profile = await load((await params).username);
  if (!profile) notFound();

  const supabase = await createClient();
  const [{ data: listings }, { data: reviews }] = await Promise.all([
    supabase
      .from("listings")
      .select(
        "id, title, price_cents, currency, condition, city, municipality, age_stages, status, listing_images(storage_path, position)",
      )
      .eq("seller_id", profile.id)
      .eq("status", "active")
      .order("published_at", { ascending: false })
      .order("position", { referencedTable: "listing_images" })
      .limit(1, { referencedTable: "listing_images" })
      .limit(24),
    supabase
      .from("reviews")
      .select("id, rating, comment, created_at, reviewer:profiles!reviews_reviewer_id_fkey(display_name)")
      .eq("reviewee_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const location = [profile.municipality, profile.city].filter(Boolean).join(", ");

  return (
    <div className="space-y-8">
      <header className="flex items-center gap-4">
        {profile.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.avatar_url} alt="" className="size-20 rounded-full object-cover" />
        ) : (
          <span className="flex size-20 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
            <UserRound className="size-9" />
          </span>
        )}
        <div className="min-w-0 space-y-1">
          <h1 className="truncate text-2xl font-extrabold">{profile.display_name}</h1>
          <p className="flex flex-wrap items-center gap-x-3 text-sm text-muted-foreground">
            {profile.rating_count > 0 ? (
              <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                <Star className="size-4 fill-primary text-primary" /> {Number(profile.rating_avg).toFixed(1)} (
                {profile.rating_count})
              </span>
            ) : (
              <span>Sin reseñas aún</span>
            )}
            <span>{profile.sales_count} ventas</span>
            {location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" /> {location}
              </span>
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            En {SITE_NAME} desde {monthFmt.format(new Date(profile.created_at))}
          </p>
        </div>
      </header>

      {profile.bio && <p className="max-w-2xl whitespace-pre-line text-sm">{profile.bio}</p>}

      <section>
        <h2 className="mb-3 text-lg font-extrabold">En venta ({listings?.length ?? 0})</h2>
        {listings?.length ? (
          <ul className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">
            {(listings as ListingCardData[]).map((l) => (
              <li key={l.id}>
                <ListingCard listing={l} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No tiene productos en venta ahora.</p>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-extrabold">Reseñas</h2>
        {reviews?.length ? (
          <ul className="space-y-3">
            {reviews.map((r) => (
              <li key={r.id} className="rounded-2xl border bg-card p-4 text-sm">
                <p className="flex gap-0.5" aria-label={`${r.rating} de 5 estrellas`}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={n}
                      className={cn("size-4", n <= r.rating ? "fill-primary text-primary" : "text-muted-foreground")}
                    />
                  ))}
                </p>
                {r.comment && <p className="mt-1.5">{r.comment}</p>}
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {(r.reviewer as unknown as { display_name: string } | null)?.display_name ?? "Usuario"} ·{" "}
                  {monthFmt.format(new Date(r.created_at))}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Todavía no tiene reseñas.</p>
        )}
      </section>
    </div>
  );
}
