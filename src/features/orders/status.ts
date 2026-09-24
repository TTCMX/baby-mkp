import type { OrderStatus } from "@/lib/domain/constants";

export const ORDER_STATUS: Record<OrderStatus, { label: string; tone: string }> = {
  pending_payment: { label: "Esperando pago", tone: "bg-muted text-muted-foreground" },
  paid: { label: "Pagado · por entregar", tone: "bg-accent text-accent-foreground" },
  in_delivery: { label: "En camino", tone: "bg-secondary text-secondary-foreground" },
  delivered: { label: "Entregado", tone: "bg-secondary text-secondary-foreground" },
  completed: { label: "Completado", tone: "bg-foreground text-background" },
  cancelled: { label: "Cancelado", tone: "bg-muted text-muted-foreground" },
  refunded: { label: "Reembolsado", tone: "bg-muted text-muted-foreground" },
};
