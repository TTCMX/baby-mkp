import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Doc, H2 } from "@/features/legal/doc";
import { getPlatformSettings } from "@/lib/settings";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "Ayuda",
  description: `Cómo comprar, vender y cobrar en ${SITE_NAME}.`,
  alternates: { canonical: "/ayuda" },
};

function Q({ q, children }: { q: string; children: ReactNode }) {
  return (
    <details className="group rounded-2xl border-[1.5px] bg-card px-4 py-3 open:pb-4">
      <summary className="cursor-pointer list-none font-semibold marker:hidden [&::-webkit-details-marker]:hidden">
        <span className="flex items-center justify-between gap-3">
          {q}
          <span aria-hidden className="text-primary transition-transform group-open:rotate-45">
            +
          </span>
        </span>
      </summary>
      <div className="mt-2 space-y-2 text-muted-foreground">{children}</div>
    </details>
  );
}

export default async function HelpPage() {
  const s = await getPlatformSettings();
  const whatsapp = s.support_whatsapp.replace(/\D/g, "");

  return (
    <Doc title="Ayuda">
      <H2>Comprar</H2>
      <div className="space-y-2">
        <Q q="¿Cómo compro?">
          <p>
            Abre el producto, toca <b>Comprar</b>, elige cómo recibirlo y paga con tarjeta, con tu saldo o con ambos. Te
            avisamos por correo y en el sitio cada vez que tu pedido avance.
          </p>
        </Q>
        <Q q="¿Es seguro pagar aquí?">
          <p>
            Sí. El pago lo procesa Stripe y nosotros lo guardamos hasta que confirmas que recibiste el producto. Si no
            llega o no es lo que se describió, repórtalo desde tu pedido antes de confirmar y te ayudamos.
          </p>
        </Q>
        <Q q="¿Qué pasa si no confirmo que lo recibí?">
          <p>
            Si no confirmas ni reportas un problema dentro de {s.order_auto_complete_days} días después de que se marcó
            como entregado, damos la compra por buena y le pagamos a quien vendió.
          </p>
        </Q>
        <Q q="¿Puedo devolver un producto?">
          <p>
            Son productos usados entre familias, así que no hay cambios por talla o gusto. Si llegó dañado o es distinto
            a lo descrito, repórtalo desde tu pedido y lo revisamos.
          </p>
        </Q>
      </div>

      <H2>Vender</H2>
      <div className="space-y-2">
        <Q q="¿Cómo vendo algo?">
          <p>
            Toca <Link href="/sell/new">Vender</Link>, sube fotos con buena luz, describe su estado con honestidad y pon
            tu precio. Cuando alguien lo compre te llegará un aviso con los datos de la entrega.
          </p>
        </Q>
        <Q q="¿Cuánto cobran?">
          <p>
            Publicar es gratis. Cuando vendes, cobramos el {s.platform_commission_percentage}% del precio del producto.
            Lo que paga el comprador por el envío cubre la guía y no entra a tu saldo.
          </p>
        </Q>
        <Q q="¿Cuándo recibo mi dinero?">
          <p>
            Cuando quien compró confirma que lo recibió (o pasan {s.order_auto_complete_days} días sin problemas), el
            dinero entra a tu <Link href="/balance">saldo</Link>. Puedes usarlo para comprar o retirarlo a tu CLABE: lo
            que pidas hasta el viernes a las 23:59 te llega el martes siguiente.
          </p>
        </Q>
        <Q q="¿Qué no puedo vender?">
          <p>
            Productos retirados del mercado, sillas de auto chocadas o vencidas, alimentos, medicamentos, cosméticos y
            extractores de leche usados. Consulta la lista completa en los <Link href="/terminos">Términos</Link>.
          </p>
        </Q>
      </div>

      <H2>Contacto</H2>
      {s.support_email || whatsapp ? (
        <p>
          ¿Algo no salió bien? Escríbenos
          {s.support_email && (
            <>
              {" "}
              a <a href={`mailto:${s.support_email}`}>{s.support_email}</a>
            </>
          )}
          {s.support_email && whatsapp && " o"}
          {whatsapp && (
            <>
              {" "}
              por <a href={`https://wa.me/${whatsapp}`}>WhatsApp</a>
            </>
          )}
          . Si es sobre un pedido, incluye su número.
        </p>
      ) : (
        <p>¿Algo no salió bien? Muy pronto publicaremos aquí nuestro correo de atención.</p>
      )}
      <p className="text-sm text-muted-foreground">
        <Link href="/terminos">Términos y condiciones</Link> · <Link href="/privacidad">Aviso de privacidad</Link>
      </p>
    </Doc>
  );
}
