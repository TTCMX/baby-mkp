"use client";

import { useActionState, useState, useTransition } from "react";
import { CheckCircle2, Download, PackageCheck, Star, Truck, TriangleAlert } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { DeliveryMethod, OrderStatus } from "@/lib/domain/constants";
import { cn } from "@/lib/utils";
import {
  confirmReceived,
  markDelivered,
  markShipped,
  reportProblem,
  savePickupAddress,
  submitReview,
  type OrderActionResult,
  type PickupAddressState,
} from "./actions";
import { AddressFields, type SavedAddress } from "@/features/checkout/address-fields";

function useAction() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const run = (fn: () => Promise<OrderActionResult>, onOk?: () => void) =>
    start(async () => {
      const r = await fn();
      setError(r.error);
      if (!r.error) onOk?.();
    });
  return { pending, error, run };
}

function ErrorText({ error }: { error?: string }) {
  return error ? (
    <p role="alert" className="text-sm font-semibold text-destructive">
      {error}
    </p>
  ) : null;
}

export function SellerActions({
  orderId,
  status,
  deliveryMethod,
  label,
  pickup,
}: {
  orderId: string;
  status: OrderStatus;
  deliveryMethod: DeliveryMethod;
  label: { url: string | null; carrier: string | null; tracking: string | null };
  /** Where the package leaves from (null until the seller says) and their saved address to start from. */
  pickup?: { current: Record<string, string> | null; saved: SavedAddress };
}) {
  const { pending, error, run } = useAction();

  // Shipping: the platform sends a prepaid label; the seller prints it and drops the package off.
  if (status === "paid" && deliveryMethod === "shipping") {
    if (!label.url) {
      if (pickup && !pickup.current) return <PickupAddressForm orderId={orderId} saved={pickup.saved} />;
      return (
        <div className="space-y-2 text-sm">
          <p>
            Estamos preparando tu <b>guía prepagada</b>. Te avisaremos por correo en cuanto esté lista; mientras, deja
            el producto limpio y empacado.
          </p>
          {pickup?.current && (
            <p className="text-xs text-muted-foreground">
              Sale de:{" "}
              {[
                pickup.current.street,
                pickup.current.exteriorNumber,
                pickup.current.neighborhood,
                pickup.current.postalCode,
                pickup.current.municipality,
              ]
                .filter(Boolean)
                .join(", ")}
            </p>
          )}
        </div>
      );
    }
    return (
      <div className="space-y-3 text-sm">
        <ol className="list-decimal space-y-1 pl-5">
          <li>Descarga e imprime tu guía.</li>
          <li>Empaca bien el producto y pega la guía por fuera.</li>
          <li>Entrégalo en una sucursal de {label.carrier ?? "la paquetería"}.</li>
        </ol>
        <a
          href={label.url}
          target="_blank"
          rel="noreferrer"
          className={cn(buttonVariants({ variant: "outline" }), "w-full")}
        >
          <Download /> Descargar guía{label.tracking ? ` · ${label.tracking}` : ""}
        </a>
        <Button className="w-full" disabled={pending} onClick={() => run(() => markShipped(orderId, {}))}>
          <Truck /> Ya lo entregué en la paquetería
        </Button>
        <ErrorText error={error} />
      </div>
    );
  }
  if (status === "paid" || status === "in_delivery") {
    return (
      <div className="space-y-2">
        <Button className="w-full" disabled={pending} onClick={() => run(() => markDelivered(orderId))}>
          <PackageCheck /> Marcar como entregado
        </Button>
        <p className="text-xs text-muted-foreground">
          {deliveryMethod === "shipping"
            ? "Márcalo cuando la paquetería confirme la entrega."
            : "Márcalo cuando le hayas entregado el producto al comprador."}
        </p>
        <ErrorText error={error} />
      </div>
    );
  }
  return null;
}

export function BuyerActions({
  orderId,
  autoCompleteDays,
  notShippedYet,
}: {
  orderId: string;
  autoCompleteDays: number;
  /** A shipping order still being prepared: there's nothing to receive yet. */
  notShippedYet: boolean;
}) {
  const { pending, error, run } = useAction();
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState("");

  if (reporting) {
    return (
      <div className="space-y-3">
        <Label htmlFor="reason">¿Qué pasó?</Label>
        <Textarea
          id="reason"
          rows={4}
          maxLength={1000}
          value={reason}
          placeholder="Ej. No coincide con la descripción, llegó dañado, no lo he recibido…"
          onChange={(e) => setReason(e.target.value)}
        />
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => setReporting(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            className="flex-1"
            disabled={pending}
            onClick={() => run(() => reportProblem(orderId, reason))}
          >
            Enviar reporte
          </Button>
        </div>
        <ErrorText error={error} />
      </div>
    );
  }
  if (notShippedYet) {
    return (
      <div className="space-y-2 text-sm">
        <p>El vendedor está preparando tu paquete. Te avisaremos por correo con el número de guía en cuanto salga.</p>
        <Button
          variant="ghost"
          className="w-full text-destructive"
          disabled={pending}
          onClick={() => setReporting(true)}
        >
          <TriangleAlert /> Reportar un problema
        </Button>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <Button
        className="w-full"
        disabled={pending}
        onClick={() => {
          if (window.confirm("¿Confirmas que recibiste el producto y está bien? Liberaremos el pago al vendedor.")) {
            run(() => confirmReceived(orderId));
          }
        }}
      >
        <CheckCircle2 /> Ya lo recibí y está bien
      </Button>
      <Button variant="ghost" className="w-full text-destructive" disabled={pending} onClick={() => setReporting(true)}>
        <TriangleAlert /> Reportar un problema
      </Button>
      <p className="text-xs text-muted-foreground">
        Si el vendedor lo marca como entregado y no nos dices nada en {autoCompleteDays} días, daremos la compra por
        buena.
      </p>
      <ErrorText error={error} />
    </div>
  );
}

export function ReviewForm({ orderId, revieweeName }: { orderId: string; revieweeName: string }) {
  const { pending, error, run } = useAction();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");

  return (
    <div className="space-y-3">
      <p className="text-sm font-bold">¿Cómo te fue con {revieweeName}?</p>
      <div className="flex gap-1" role="radiogroup" aria-label="Calificación">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n} estrella${n > 1 ? "s" : ""}`}
            onClick={() => setRating(n)}
            className="p-1"
          >
            <Star className={cn("size-8", n <= rating ? "fill-primary text-primary" : "text-muted-foreground")} />
          </button>
        ))}
      </div>
      <Textarea
        rows={3}
        maxLength={1000}
        placeholder="Comentario (opcional)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        aria-label="Comentario"
      />
      <Button disabled={pending || rating === 0} onClick={() => run(() => submitReview(orderId, { rating, comment }))}>
        Publicar reseña
      </Button>
      <ErrorText error={error} />
    </div>
  );
}

/** Before the platform can buy the label it needs the package's origin. */
function PickupAddressForm({ orderId, saved }: { orderId: string; saved: SavedAddress }) {
  const [state, action, pending] = useActionState<PickupAddressState, FormData>(
    savePickupAddress.bind(null, orderId),
    undefined,
  );
  const err = (name: string) => state?.fieldErrors?.[name];
  return (
    <form action={action} className="space-y-3">
      <p className="text-sm">
        <b>¿Desde dónde lo envías?</b> Con esta dirección compramos tu guía prepagada; no la verá el comprador.
      </p>
      <AddressFields saved={saved} err={err} />
      {state?.error && (
        <p role="alert" className="text-sm font-semibold text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Guardando…" : "Guardar dirección de envío"}
      </Button>
    </form>
  );
}
