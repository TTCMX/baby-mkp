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
  "withdrawal.paid": "Marcó un retiro como pagado",
  "managed.bank_account": "Guardó la CLABE de un vendedor gestionado",
  "managed.withdrawal": "Pidió un retiro para un vendedor gestionado",
  "order.ship": "Marcó un pedido como enviado",
  "order.deliver": "Marcó un pedido como entregado",
  "withdrawal.failed": "Marcó un retiro como no pagado",
  "settings.update": "Cambió la configuración",
  "category.create": "Creó una categoría",
  "category.update": "Editó una categoría",
};

export const auditLabel = (action: string) => AUDIT_LABELS[action] ?? action;
