"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Heart } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { setFavorite } from "./actions";

/** "Guardar" on a listing: toggles instantly, the server confirms. Visitors are sent to sign in first. */
export function FavoriteButton({
  listingId,
  initialSaved,
  signedIn,
}: {
  listingId: string;
  initialSaved: boolean;
  signedIn: boolean;
}) {
  const [saved, setSaved] = useState(initialSaved);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  if (!signedIn) {
    return (
      <Link
        href={`/login?next=${encodeURIComponent(`/listing/${listingId}`)}`}
        className={buttonVariants({ variant: "outline" })}
      >
        <Heart /> Guardar
      </Link>
    );
  }

  return (
    <span className="flex flex-col">
      <Button
        variant="outline"
        aria-pressed={saved}
        disabled={pending}
        onClick={() => {
          const next = !saved;
          setSaved(next);
          setError(undefined);
          start(async () => {
            const r = await setFavorite(listingId, next);
            setSaved(r.saved);
            if (r.error) setError(r.error);
          });
        }}
        className={cn(saved && "border-pink-ink")}
      >
        <Heart className={cn(saved && "fill-pink-ink text-pink-ink")} /> {saved ? "Guardado" : "Guardar"}
      </Button>
      {error && <span className="mt-1 text-center text-xs font-semibold text-destructive">{error}</span>}
    </span>
  );
}
