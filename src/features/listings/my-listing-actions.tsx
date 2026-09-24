"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import type { ListingStatus } from "@/lib/domain/constants";
import { deleteListing, publishListing, unpublishListing } from "./actions";

export function MyListingActions({ id, status }: { id: string; status: ListingStatus }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();

  const run = (fn: () => Promise<{ error?: string }>) =>
    start(async () => {
      const result = await fn();
      setError(result.error);
    });

  const editable = status !== "reserved" && status !== "sold";
  const canPublish = status === "draft" || status === "inactive" || status === "rejected";
  const canPause = status === "active" || status === "pending_review";
  const canDelete = status === "draft" || status === "inactive" || status === "rejected";

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-2">
        {editable && (
          <Link href={`/sell/${id}/edit`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            Editar
          </Link>
        )}
        {canPublish && (
          <Button size="sm" disabled={pending} onClick={() => run(() => publishListing(id))}>
            Publicar
          </Button>
        )}
        {canPause && (
          <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => unpublishListing(id))}>
            Pausar
          </Button>
        )}
        {canDelete && (
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive"
            disabled={pending}
            onClick={() => {
              if (window.confirm("¿Borrar este producto? No se puede deshacer.")) run(() => deleteListing(id));
            }}
          >
            Borrar
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-xs font-semibold text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
