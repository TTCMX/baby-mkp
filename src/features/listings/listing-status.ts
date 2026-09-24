import type { ListingStatus } from "@/lib/domain/constants";

export const LISTING_STATUS_LABELS: Record<ListingStatus, { label: string; tone: string }> = {
  draft: { label: "Borrador", tone: "bg-muted text-muted-foreground" },
  pending_review: { label: "En revisión", tone: "bg-secondary text-secondary-foreground" },
  active: { label: "Publicado", tone: "bg-accent text-accent-foreground" },
  reserved: { label: "Reservado", tone: "bg-secondary text-secondary-foreground" },
  sold: { label: "Vendido", tone: "bg-foreground text-background" },
  inactive: { label: "Pausado", tone: "bg-muted text-muted-foreground" },
  rejected: { label: "Rechazado", tone: "bg-destructive/10 text-destructive" },
};
