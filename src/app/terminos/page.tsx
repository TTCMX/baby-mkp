import type { Metadata } from "next";
import Link from "next/link";
import { Doc, H2, List, Setting } from "@/features/legal/doc";
import { getPlatformSettings } from "@/lib/settings";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "Términos y condiciones",
  description: `Reglas para comprar y vender en ${SITE_NAME}.`,
  alternates: { canonical: "/terminos" },
};

export default async function TermsPage() {
  const s = await getPlatformSettings();
  const contact = <Setting value={s.support_email} missing="correo de atención por definir" />;

  return (
    <Doc title="Términos y condiciones" updated="8 de octubre de 2026">
      <p>
        Estos términos regulan el uso de {SITE_NAME} (el &quot;sitio&quot;), operado por{" "}
        <Setting value={s.legal_name} missing="responsable por definir" /> (&quot;nosotros&quot;). Al crear una cuenta,
        comprar o vender aceptas estos términos y nuestro <Link href="/privacidad">Aviso de privacidad</Link>.
      </p>

      <H2>1. Qué es {SITE_NAME}</H2>
      <p>
        Somos un mercado en línea donde familias en México compran y venden productos de bebé usados. Las personas que
        venden son las dueñas de sus productos y responden por ellos: nosotros no los fabricamos ni los revisamos
        físicamente (salvo los que guardamos en nuestra bodega). Te damos las herramientas para publicar, pagar de forma
        segura, coordinar la entrega y resolver problemas.
      </p>

      <H2>2. Tu cuenta</H2>
      <List>
        <li>Debes ser mayor de edad y dar datos verdaderos. La cuenta es personal.</li>
        <li>Cuida tu contraseña: lo que se haga desde tu cuenta es tu responsabilidad.</li>
        <li>
          Podemos suspender cuentas que incumplan estos términos, que intenten defraudar o que pongan en riesgo a otras
          personas.
        </li>
      </List>

      <H2>3. Vender</H2>
      <List>
        <li>
          Publica solo productos que sean tuyos, con fotos reales y una descripción honesta de su estado, talla, edad y
          defectos.
        </li>
        <li>
          Al recibir una compra, entrégalo o envíalo en el plazo acordado y en el estado descrito. Si ya no lo tienes,
          avísanos para cancelar y reembolsar a quien compró.
        </li>
        <li>
          Cobramos una comisión del {s.platform_commission_percentage}% sobre el precio de cada venta, que se descuenta
          antes de abonar tu saldo. El costo de envío que pagó el comprador no causa comisión.
        </li>
        <li>Podemos revisar, pedir cambios o retirar publicaciones que no cumplan estas reglas.</li>
      </List>

      <H2>4. Productos que no se permiten</H2>
      <List>
        <li>Productos retirados del mercado (recall) o con fallas de seguridad conocidas.</li>
        <li>
          Sillas de auto que hayan estado en un choque, vencidas o sin sus piezas y etiquetas; cunas y corrales
          modificados o incompletos.
        </li>
        <li>Alimentos, fórmulas abiertas, medicamentos, cosméticos usados y extractores de leche usados.</li>
        <li>Productos falsificados, robados o cuya venta prohíba la ley.</li>
      </List>

      <H2>5. Comprar y pagar</H2>
      <List>
        <li>
          El precio que ves incluye todo lo del producto; el envío, cuando aplica, se muestra antes de pagar. Pagas con
          tarjeta a través de Stripe, con tu saldo o con ambos. No guardamos los datos de tu tarjeta.
        </li>
        <li>
          Guardamos tu pago hasta que confirmas que recibiste el producto. Si no confirmas ni reportas un problema
          dentro de {s.order_auto_complete_days} días después de marcado como entregado, damos la compra por buena y
          liberamos el pago a quien vendió.
        </li>
        <li>
          Si el producto no llega o es muy distinto a lo descrito, repórtalo desde tu pedido antes de confirmar.
          Revisamos el caso con ambas partes y, si procede, te devolvemos tu dinero.
        </li>
        <li>
          Por ser productos usados entre particulares, no hay cambios por talla o gusto: revisa bien la descripción y
          pregunta antes de comprar.
        </li>
      </List>

      <H2>6. Saldo y retiros</H2>
      <List>
        <li>
          Lo que vendes se abona a tu saldo cuando la compra se completa. Puedes usarlo para comprar en el sitio o
          retirarlo a tu cuenta bancaria (CLABE) a tu nombre.
        </li>
        <li>
          Los retiros solicitados hasta el viernes a las 23:59 (hora del centro de México) se pagan el martes siguiente
          por SPEI.
          {s.withdrawal_min_cents > 0 &&
            ` El retiro mínimo es de $${(s.withdrawal_min_cents / 100).toLocaleString("es-MX")}.`}
        </li>
        <li>
          El saldo no es un depósito bancario, no genera intereses y solo puede salir a una cuenta del mismo titular. Si
          una compra se reembolsa después de abonada, el monto se descuenta de tu saldo.
        </li>
      </List>

      <H2>7. Entregas</H2>
      <p>
        Cada producto indica cómo se entrega: en persona, entrega local o envío. En entregas en persona, quedar en un
        lugar público y revisar el producto antes de confirmar es responsabilidad de ambas partes. En envíos, quien
        vende debe empacar bien y compartir la guía.
      </p>

      <H2>8. Conducta</H2>
      <p>
        No uses el sitio para acosar, engañar, pedir pagos fuera de la plataforma ni compartir datos de otras personas.
        Los pagos fuera de {SITE_NAME} no están protegidos.
      </p>

      <H2>9. Responsabilidad</H2>
      <p>
        Hacemos lo razonable para que el sitio funcione bien y sea seguro, pero no garantizamos que esté libre de
        interrupciones. No respondemos por el estado de los productos más allá de la protección de pago descrita en la
        sección 5, salvo lo que establezca la Ley Federal de Protección al Consumidor.
      </p>

      <H2>10. Cambios, ley aplicable y contacto</H2>
      <p>
        Podemos actualizar estos términos; si el cambio es importante te avisaremos en el sitio o por correo. Se rigen
        por las leyes de México. Para cualquier duda o queja escríbenos a {contact}; también puedes acudir a la
        Procuraduría Federal del Consumidor (Profeco).
      </p>
    </Doc>
  );
}
