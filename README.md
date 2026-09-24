# Baby Recommerce

Marketplace C2C mobile-first para comprar y vender productos de bebé de segunda mano.

**Stack:** Next.js 16 (App Router, Server Actions) · TypeScript · Tailwind CSS 4 + componentes estilo shadcn/ui ·
Supabase (Postgres, Auth, Storage) · Stripe Connect · OpenAI · PostHog · Sentry · Resend · Vercel.

Monolito modular. Sin backend separado, microservicios, GraphQL, Redis ni Elasticsearch.

## Puesta en marcha

```bash
npm install
cp .env.example .env.local        # completar las claves de Supabase
npx supabase start                # Supabase local (requiere Docker)
npx supabase db reset             # aplica migraciones + seed
npm run dev
```

Para hacer admin a un usuario: `update profiles set role = 'admin' where username = '...';`

## Despliegue de la base de datos

`.github/workflows/supabase-migrations.yml` aplica `supabase/migrations/` al proyecto de Supabase
en cada push a `main` (también se puede lanzar a mano desde la pestaña Actions). Funciona en el plan gratuito.
Requiere los secrets de GitHub `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_ID` y `SUPABASE_DB_PASSWORD`.

- Nunca se edita una migración ya aplicada: cada cambio de esquema es un archivo nuevo (`npx supabase migration new <nombre>`).
- `seed.sql` **no** corre en producción. Los datos que la app necesita
  (categorías, marcas, `platform_settings`) están en la migración `..._reference_data.sql`.
- En Supabase → Authentication → URL Configuration: `Site URL` = dominio de producción y en
  Redirect URLs `https://<dominio>/auth/callback`.
- En Vercel: `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
  `SUPABASE_SECRET_KEY` (esta última solo en el servidor).

## Stripe

- Endpoint del webhook: `https://<dominio>/api/stripe/webhook`, eventos `checkout.session.completed`,
  `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`.
- La comisión sale de `platform_settings` (`platform_commission_percentage`, o `concierge_commission_percentage`
  para ventas concierge) y se guarda como snapshot en la orden junto con la tarifa de Stripe y los netos.

## Tareas programadas

`vercel.json` programa `/api/cron/orders` una vez al día (plan Hobby). Requiere la variable `CRON_SECRET` en Vercel.

## Scripts

| Script | Qué hace |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` | ESLint |
| `npm run typecheck` | Genera los tipos de rutas y corre `tsc` |
| `npm test` | Tests unitarios (Vitest) |
| `npm run db:test` | Aplica migraciones + seed + tests de RLS en un PostgreSQL local desechable (sin Docker) |
| `npm run db:types` | Genera tipos TS desde Supabase local |

## Estructura

```
src/
  app/                 Rutas (App Router). Páginas delgadas, solo componen features.
  features/<módulo>/   Lógica por dominio: server actions, queries, componentes
                       (auth, profile, catalog; después listings, orders, payments,
                       messaging, concierge, admin)
  components/ui/       Primitivas de UI (estilo shadcn/ui)
  components/layout/   Header, navegación móvil
  lib/                 Infra compartida: supabase clients, auth guards, env,
                       pricing (comisiones), money, analytics, settings
  proxy.ts             Refresca la sesión y protege rutas privadas (Next 16 "proxy")
supabase/
  migrations/          Esquema, seguridad (RLS + grants + RPCs), storage
  seed.sql             Categorías, marcas, platform_settings
  tests/               Tests de RLS / reglas de negocio
```

## Decisiones clave

- **Dinero en centavos (enteros).** Comisiones en `platform_settings`, nunca hardcodeadas
  (`platform_commission_percentage`, `concierge_commission_percentage`, `concierge_min_price_cents`).
  Las órdenes guardan un *snapshot* del desglose: precio, envío, comisión, fees de pago, neto vendedor, neto plataforma.
  El cálculo vive en `src/lib/pricing.ts` (con tests).
- **Público vs privado por tabla.** `profiles` es público; email, teléfono, Stripe y direcciones viven en
  `private_profiles` / `addresses`, visibles solo para el dueño (y admin).
- **Seguridad en la base de datos, no en el frontend.** RLS en todas las tablas + *grants por columna*:
  un usuario no puede cambiar `status`, `role`, contadores ni ids de Stripe aunque llame a la API directamente.
  Publicar pasa por la RPC `publish_listing` (valida fotos, etapa, envío permitido y moderación).
  Órdenes, pagos y payouts solo los escribe el servidor (service role) desde checkout y webhooks de Stripe.
- **Búsqueda:** PostgreSQL Full Text Search en español sin acentos (`es_unaccent`), con pesos
  título/marca/modelo > categoría > descripción.
- **Storage:** buckets `listing-images` (10 MB) y `avatars` (2 MB), solo JPEG/PNG/WebP, escritura solo en la carpeta propia.
- Las migraciones futuras que creen funciones deben revocar `execute` a `anon/authenticated`
  y otorgarlo explícitamente (Supabase lo concede por defecto).

## Estado por etapas

- [x] **1. Estructura del proyecto**
- [x] **2–3. Esquema de DB + migraciones** (todas las tablas del modelo inicial, RLS, storage, seed)
- [x] **4. Autenticación** (registro, login, callback de email, logout, rutas protegidas, perfil/ajustes, cuentas suspendidas)
- [x] **5. Listings:** flujo "Vender" en 5 pasos (fotos → detalles → descripción → entrega → vista previa), borradores,
  edición, pausar/publicar/borrar, "Mis productos" y página de producto `/listing/[id]`.
  Las fotos se redimensionan en el navegador (≤1600 px + miniatura ≤600 px, WebP/JPEG) y se suben directo a Storage.
- [x] **6. Catálogo:** búsqueda de texto (PostgreSQL FTS en español, sin acentos, palabras parciales, también por edad
  y condición), filtros combinables en la URL (categoría, precio, marca, condición, edad, ubicación con alias como
  "CDMX", entrega), orden, paginación, `/category/[slug]` y home con Nuevos / Cerca de ti / Populares / Compra por etapa.
- [x] **7. Checkout con Stripe Connect:** el comprador elige entrega (+ dirección), paga en Stripe Checkout;
  el producto queda reservado mientras paga y vendido al confirmarse el pago (webhook firmado e idempotente).
  Modelo *separate charges and transfers*: la plataforma cobra y retiene; la transferencia al vendedor se hace al
  completar la orden (etapa 8). Vendedores configuran cobros con onboarding de Stripe (cuenta Express, MX).
  Reembolso automático si un pago llega después de liberar la reserva. `/orders` y `/orders/[id]` básicos.
- [x] **8. Órdenes:** el vendedor marca enviado (con guía) o entregado; el comprador confirma o reporta un problema
  (congela la orden y el pago). Si no hay respuesta en `order_auto_complete_days` (3) días tras "entregado", se
  completa sola (al abrir la orden y con el job diario `/api/cron/orders`). Al completar se transfiere el neto al
  vendedor (Stripe transfer idempotente; queda pendiente y se paga solo cuando termina su alta de cobros).
  Reseñas en ambos sentidos, perfil público `/profile/[username]`, avisos en la app y contacto entre las partes
  tras el pago.
- [ ] 9. Admin (listings, usuarios, órdenes, concierge, categorías, configuración)
- [ ] 10. P1: favoritos, chat, wishlist, IA para listings, concierge

Las rutas de etapas futuras (`/sell/new`, `/search`, `/listing/[id]`, …) existen como placeholders.
