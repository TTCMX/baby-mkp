import type { Metadata } from "next";
import Link from "next/link";
import { Contact, Doc, H2, List } from "@/features/legal/doc";
import { getPlatformSettings } from "@/lib/settings";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "Aviso de privacidad",
  description: `Cómo ${SITE_NAME} trata tus datos personales.`,
  alternates: { canonical: "/privacidad" },
};

export default async function PrivacyPage() {
  const s = await getPlatformSettings();
  const contact = <Contact email={s.support_email} />;

  return (
    <Doc title="Aviso de privacidad" updated="8 de octubre de 2026">
      <p>
        {s.legal_name || SITE_NAME}
        {s.legal_address && `, con domicilio en ${s.legal_address},`} es responsable del tratamiento de tus datos
        personales en {SITE_NAME}, conforme a la Ley Federal de Protección de Datos Personales en Posesión de los
        Particulares y su reglamento.
      </p>

      <H2>Datos que tratamos</H2>
      <List>
        <li>
          <b>Identificación y contacto:</b> nombre, correo, teléfono, ciudad y foto de perfil (si la subes).
        </li>
        <li>
          <b>Entrega:</b> dirección y datos de quien recibe, cuando compras con envío.
        </li>
        <li>
          <b>Financieros y patrimoniales:</b> tu CLABE, banco y titular para pagarte tus retiros, y el historial de tu
          saldo. Los datos de tu tarjeta los recibe y guarda Stripe; nosotros no los vemos.
        </li>
        <li>
          <b>De tus bebés:</b> nombre o apodo y fecha de nacimiento o fecha probable de parto, solo si los registras,
          para mostrarte productos de su etapa. Son privados: nadie más los ve.
        </li>
        <li>
          <b>De uso:</b> productos que publicas, compras, favoritos, búsquedas y datos técnicos (dispositivo, navegador,
          IP).
        </li>
      </List>
      <p>No tratamos datos personales sensibles.</p>

      <H2>Para qué los usamos</H2>
      <p>Finalidades necesarias para el servicio:</p>
      <List>
        <li>Crear y administrar tu cuenta y tus publicaciones.</li>
        <li>Procesar compras, pagos, reembolsos, tu saldo y tus retiros.</li>
        <li>
          Coordinar entregas: compartimos con la otra parte de una compra solo lo necesario (nombre, teléfono, correo y,
          en envíos, la dirección de entrega).
        </li>
        <li>Enviarte avisos de tus pedidos y de tu cuenta (en el sitio y por correo).</li>
        <li>Prevenir fraudes, atender problemas y cumplir obligaciones legales y fiscales.</li>
      </List>
      <p>Finalidades secundarias (puedes negarte sin perder el servicio):</p>
      <List>
        <li>Medir cómo se usa el sitio para mejorarlo.</li>
        <li>Recomendarte productos según la etapa de tus bebés.</li>
      </List>
      <p>
        Para negarte a las finalidades secundarias escríbenos{s.support_email ? " a " : " desde "}
        {contact}.
      </p>

      <H2>Con quién los compartimos</H2>
      <p>
        Con la otra persona de cada compra, en los términos de arriba. Además usamos proveedores que tratan datos por
        nuestra cuenta y bajo nuestras instrucciones: Stripe (pagos), Supabase (base de datos y archivos), Vercel
        (hospedaje), Resend (correos) y PostHog (medición de uso). Algunos guardan información fuera de México. No
        vendemos tus datos. Fuera de esto, solo los compartiremos cuando una autoridad competente lo requiera.
      </p>

      <H2>Cookies y tecnologías similares</H2>
      <p>
        Usamos cookies necesarias para mantener tu sesión iniciada y medición anónima del rendimiento del sitio. No
        usamos cookies de publicidad.
      </p>

      <H2>Tus derechos (ARCO) y tu consentimiento</H2>
      <p>
        Puedes acceder a tus datos, rectificarlos, cancelarlos u oponerte a su uso, así como revocar tu consentimiento o
        limitar su uso. Muchos los puedes cambiar tú mismo en <Link href="/settings">tu cuenta</Link>. Para lo demás,
        escríbenos{s.support_email ? " a " : " desde "}
        {contact} con tu nombre, el correo de tu cuenta, lo que pides y, si es el caso, el dato a corregir. Te
        responderemos en un máximo de 20 días hábiles y, si procede, lo haremos efectivo dentro de los 15 días hábiles
        siguientes. Conservamos algunos datos de compras y pagos el tiempo que exigen las leyes fiscales.
      </p>

      <H2>Cambios a este aviso</H2>
      <p>
        Cualquier cambio lo publicaremos en esta página, con su fecha de actualización, y si es importante te avisaremos
        en el sitio o por correo.
      </p>
    </Doc>
  );
}
