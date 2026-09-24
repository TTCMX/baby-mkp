export const AUDIT_LABELS: Record<string, string> = {
  "listing.approve": "Aprobó un producto",
  "listing.reject": "Rechazó un producto",
  "listing.deactivate": "Desactivó un producto",
  "listing.reactivate": "Reactivó un producto",
  "listing.mark_sold": "Marcó un producto como vendido",
  "listing.edit": "Editó un producto",
  "user.suspend": "Suspendió una cuenta",
  "user.reactivate": "Reactivó una cuenta",
  "order.refund": "Reembolsó un pedido",
  "order.complete": "Completó un pedido",
  "settings.update": "Cambió la configuración",
  "category.create": "Creó una categoría",
  "category.update": "Editó una categoría",
};

export const auditLabel = (action: string) => AUDIT_LABELS[action] ?? action;
