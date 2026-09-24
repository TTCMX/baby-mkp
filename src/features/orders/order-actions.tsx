"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, PackageCheck, Star, Truck, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { DeliveryMethod, OrderStatus } from "@/lib/domain/constants";
import { cn } from "@/lib/utils";
import {
  confirmReceived,
  markDelivered,
  markShipped,
  reportProblem,
  submitReview,
  type OrderActionResult,
} from "./actions";

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
}: {
  orderId: string;
  status: OrderStatus;
  deliveryMethod: DeliveryMethod;
}) {
  const { pending, error, run } = useAction();
  const [carrier, setCarrier] = useState("");
  const [tracking, setTracking] = useState("");

  if (status === "paid" && deliveryMethod === "shipping") {
    return (
      <div className="space-y-3">
        <p className="text-sm">Cuando lo envíes, agrega la guía para que el comprador pueda rastrearlo.</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label htmlFor="carrier">Paquetería</Label>
            <Input
              id="carrier"
              placeholder="Ej. Estafeta"
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tracking">Número de guía</Label>
            <Input id="tracking" value={tracking} onChange={(e) => setTracking(e.target.value)} />
          </div>
        </div>
        <Button
          className="w-full"
          disabled={pending}
          onClick={() => run(() => markShipped(orderId, { carrier, tracking }))}
        >
          <Truck /> Marcar como enviado
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

export function BuyerActions({ orderId, autoCompleteDays }: { orderId: string; autoCompleteDays: number }) {
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
