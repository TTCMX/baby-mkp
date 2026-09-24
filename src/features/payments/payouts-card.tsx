import { CheckCircle2, Clock, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { startPayoutOnboarding } from "./actions";
import type { PayoutStatus } from "./payout-account";

const COPY: Record<PayoutStatus, { title: string; body: string; cta: string | null }> = {
  none: {
    title: "Configura cómo cobras",
    body: "Para recibir el dinero de tus ventas necesitas verificar tu identidad y agregar tu cuenta bancaria (CLABE). Lo hace Stripe de forma segura en un par de minutos.",
    cta: "Configurar cobros",
  },
  pending: {
    title: "Tu cuenta de cobros está en revisión",
    body: "Stripe necesita algún dato más o está verificando tu información. Puedes continuar donde te quedaste.",
    cta: "Continuar configuración",
  },
  active: {
    title: "Cobros activos",
    body: "Te transferimos el dinero de cada venta cuando el comprador confirma que recibió el producto.",
    cta: null,
  },
};

export function PayoutsCard({ status, error }: { status: PayoutStatus; error?: boolean }) {
  const copy = COPY[status];
  const Icon = status === "active" ? CheckCircle2 : status === "pending" ? Clock : Wallet;

  return (
    <Card id="cobros" className="scroll-mt-20 space-y-3 p-5">
      <div className="flex items-start gap-3">
        <Icon
          className={status === "active" ? "size-6 shrink-0 text-accent-foreground" : "size-6 shrink-0 text-primary"}
        />
        <div>
          <h2 className="font-extrabold">{copy.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{copy.body}</p>
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm font-semibold text-destructive">
          No pudimos abrir la configuración de cobros. Intenta de nuevo en un momento.
        </p>
      )}
      {copy.cta && (
        <form action={startPayoutOnboarding}>
          <Button type="submit" className="w-full sm:w-auto">
            {copy.cta}
          </Button>
        </form>
      )}
    </Card>
  );
}
