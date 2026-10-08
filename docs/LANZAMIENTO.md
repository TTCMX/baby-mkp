# Lanzamiento: lista de pasos

Lo que se configura fuera del código (Vercel, Supabase, Resend, Stripe, Admin), en orden. Las llaves y secretos
se pegan **solo** en Vercel / Supabase / GitHub: nunca en el código ni en chats.

## 1. Dominio

1. Vercel → proyecto → **Settings → Domains**: agrega `mercadito.baby` y `www.mercadito.baby` (que redirija a la
   principal). Copia los registros DNS que te pide en tu proveedor de dominio.
2. Vercel → **Settings → Environment Variables** (Production): `NEXT_PUBLIC_SITE_URL=https://mercadito.baby`.
3. Supabase → **Authentication → URL Configuration**:
   - Site URL: `https://mercadito.baby`
   - Redirect URLs: `https://mercadito.baby/auth/callback`

## 2. Correos con Resend

La app manda por correo cada aviso (venta nueva, pedido enviado, entregado, saldo, retiros, moderación…) y Supabase
manda los de la cuenta (confirmar correo, recuperar contraseña). Los dos salen por Resend.

1. Crea la cuenta en [resend.com](https://resend.com) → **Domains → Add domain** → `mercadito.baby`.
2. Agrega en tu proveedor de dominio los registros DNS que muestra (SPF, DKIM y MX del subdominio `send`) y espera a
   que diga **Verified**.
3. **API Keys → Create** dos llaves con permiso _Sending access_: una para Vercel y otra para Supabase.
4. Vercel (Production): `RESEND_API_KEY=<llave 1>` y `EMAIL_FROM=mercadito.baby <avisos@mercadito.baby>`. Redeploy.
5. Supabase → **Authentication → Emails → SMTP Settings** → _Enable custom SMTP_:
   - Host `smtp.resend.com`, puerto `465`, usuario `resend`, contraseña `<llave 2>`
   - Sender email `avisos@mercadito.baby`, sender name `mercadito.baby`
6. Supabase → **Authentication → Rate Limits**: sube _emails sent per hour_ (p. ej. 100). Sin SMTP propio Supabase
   solo manda 2 por hora y únicamente a miembros del equipo.
7. Supabase → **Authentication → Emails → Templates**: pega el HTML y el asunto de cada plantilla:

   | Plantilla en Supabase | Archivo                                | Asunto                               |
   | --------------------- | -------------------------------------- | ------------------------------------ |
   | Confirm signup        | `supabase/templates/confirmation.html` | Confirma tu correo en mercadito.baby |
   | Reset password        | `supabase/templates/recovery.html`     | Crea una nueva contraseña            |
   | Change email address  | `supabase/templates/email_change.html` | Confirma tu nuevo correo             |

8. Recomendado: **Authentication → Sign In / Providers → Email → Confirm email** encendido (evita cuentas con
   correos falsos). La app ya maneja ambos casos.
9. Prueba: crea una cuenta con tu correo y usa "¿Olvidaste tu contraseña?" desde `/login`.

Los avisos que no se alcanzan a enviar se reintentan en el job diario (`/api/cron/orders`); los perfiles gestionados
(bodega) no reciben correo.

## 3. Stripe en modo real

1. Stripe → activa la cuenta (datos del negocio, RFC, identificación y la cuenta bancaria donde recibes los cobros).
2. **Developers → API keys** (modo _Live_): copia la _Secret key_ (`sk_live_…`).
3. **Developers → Webhooks** (modo _Live_) → endpoint `https://mercadito.baby/api/stripe/webhook` con los eventos
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
   `checkout.session.async_payment_failed` y `checkout.session.expired`. Copia el _Signing secret_ (`whsec_…`).
4. Vercel (solo **Production**): `STRIPE_SECRET_KEY=sk_live_…` y `STRIPE_WEBHOOK_SECRET=whsec_…`. Deja las de prueba
   en _Preview_ para seguir probando sin cobrar de verdad. Redeploy.
5. Vercel: confirma que existe `CRON_SECRET` (protege el job diario).

## 4. Admin de mercadito.baby

En `/admin/settings`:

- **Datos legales y contacto**: responsable (tu nombre o razón social), domicilio, correo de atención y WhatsApp.
  Aparecen en `/terminos`, `/privacidad` y `/ayuda`; mientras falten, el responsable es "mercadito.baby" y lo demás se omite.
- **Plataforma**: comisión, días para completar, retiro mínimo.
- **Categorías**: para el lanzamiento solo _Ropa_ está activa.

En `/admin/managed`: correo y teléfono de contacto de la bodega (lo ven quienes compran productos gestionados).

## 5. Antes de anunciarlo

- [ ] Que un abogado revise **Términos y condiciones** y **Aviso de privacidad** (son un borrador sólido, no
      asesoría legal).
- [ ] Con tu contador: obligaciones fiscales de la plataforma (facturar la comisión; retenciones de plataformas
      digitales a vendedores particulares).
- [ ] Borra productos y cuentas de prueba.
- [ ] Compra real de punta a punta con un producto barato y tarjeta real: pago → correo al vendedor → enviado →
      recibido → saldo. Luego reembolsa desde `/admin/orders` y verifica que Stripe devolvió el dinero.
- [ ] Solicita un retiro de prueba y márcalo como pagado en **Admin → Retiros**.
- [ ] Revisa **Vercel → Logs** el primer día por si aparece algún error.
