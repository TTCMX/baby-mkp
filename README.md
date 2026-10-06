# Baby Recommerce

Marketplace C2C mobile-first para comprar y vender productos de bebé de segunda mano.

**Stack:** Next.js 16 (App Router, Server Actions) · TypeScript · Tailwind CSS 4 + componentes estilo shadcn/ui ·
Supabase (Postgres, Auth, Storage) · Stripe (cobro) · OpenAI · PostHog · Sentry · Resend · Vercel.

Monolito modular. Sin backend separado, microservicios, GraphQL, Redis ni Elasticsearch.

## Puesta en marcha

```bash
npm install
cp .env.example .env.local        # completar las claves de Supabase
npx supabase start                # Supabase local (requiere Docker)
npx supabase db reset             # aplica migraciones + seed
npm run dev
```

Para hacer admin a un usuario: `update profiles set role = 'admin' where username = '...';` (luego entra a `/admin`).

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

## Saldo y retiros

Los compradores pagan con tarjeta en **la cuenta de Stripe de la plataforma** (sin Stripe Connect). El vendedor recibe
**saldo** cuando la orden se completa (trigger `orders_credit_seller`) y puede:

- **usarlo para comprar**: en el checkout se aplica primero el saldo y el resto va a tarjeta; si alcanza, la orden se
  paga al instante sin Stripe. Si el pago no se completa, el saldo regresa.
- **retirarlo**: guarda su CLABE (validada con dígito verificador), nombre del titular y banco en `/balance`. Lo
  solicitado hasta el **viernes 23:59 (hora del centro)** se paga el **martes siguiente** por SPEI
  (`withdrawal_payout_date`). Mínimo configurable en Admin (`withdrawal_min_cents`, 0 = sin mínimo).

Operación semanal en **Admin → Retiros**: descarga el CSV del martes, haz las transferencias desde el banco y marca
cada retiro como pagado (con la clave de rastreo) o como no pagado (el monto regresa al saldo y se avisa al usuario).

Contabilidad: `wallet_entries` es un libro mayor de solo inserción (venta, compra, devolución, reembolso, retiro…) y
`wallets` guarda el saldo corriente; ambos siempre cuadran (lo verifican los tests). Un reembolso devuelve la parte
pagada con tarjeta por Stripe y la parte con saldo al saldo del comprador; si el vendedor ya tenía el saldo de esa
venta, se le descuenta (puede quedar negativo y se compensa con sus siguientes ventas).

> ⚖️ Un saldo que se puede gastar puede considerarse dinero electrónico (Ley Fintech / IFPE). Por diseño solo nace de
> ventas, no se recarga ni se transfiere entre usuarios y siempre se puede retirar; aun así, valídalo con un abogado.

## Vendedores gestionados e importación masiva

Para inventario en consignación (productos de muchas personas guardados en la bodega): **Admin → Gestionados →
Importar productos**.

1. Sube un CSV (plantilla descargable; Excel en español con `;` también funciona). Columnas: `id_producto`,
   `vendedor_id`, `vendedor_nombre` (+ `vendedor_alias`, `vendedor_email`, `vendedor_telefono` opcionales), `titulo`,
   `descripcion`, `categoria`, `condicion`, `edad`, `precio`, `marca`, `modelo`, `fotos` (enlaces), `piezas`.
   Acepta sinónimos ("carreola", "como nuevo", "0 a 3 meses", "RN a 2-4 años") y enlaces compartidos de Drive/Dropbox.
2. Revisión en el navegador antes de guardar nada: errores por fila, descargables.
3. Ubicación y formas de entrega de la bodega (aplican a todo el archivo).
4. Importa en lotes (3 en paralelo); descarga las fotos, las optimiza igual que el formulario de venta y crea los
   productos ya publicados. Es **re-ejecutable**: `id_producto` y `vendedor_id` son las llaves, así que repetir el
   archivo actualiza lo que cambió y no duplica (las fotos solo se vuelven a descargar si cambian sus enlaces).

Cada `vendedor_id` se vuelve un **perfil gestionado**: público con nombre + inicial (o el alias), sin acceso a la
cuenta (correo reservado `@gestionado.invalid` y contraseña aleatoria). Nombre real, correo y teléfono quedan en
`private_profiles` (solo admins). Los admins operan sus ventas (marcar enviado/entregado: la base de datos solo lo
permite para perfiles gestionados), guardan su CLABE y piden sus retiros; los compradores ven el **contacto de la
bodega** configurado en Gestionados. Las fotos usan Storage: ~15 000 fotos ocupan varios GB (el plan gratis de
Supabase tiene 1 GB).

## Tareas programadas

`vercel.json` programa `/api/cron/orders` una vez al día (plan Hobby). Requiere la variable `CRON_SECRET` en Vercel.

## Scripts

| Script                            | Qué hace                                                                                |
| --------------------------------- | --------------------------------------------------------------------------------------- |
| `npm run dev` / `build` / `start` | Next.js                                                                                 |
| `npm run lint`                    | ESLint                                                                                  |
| `npm run typecheck`               | Genera los tipos de rutas y corre `tsc`                                                 |
| `npm test`                        | Tests unitarios (Vitest)                                                                |
| `npm run db:test`                 | Aplica migraciones + seed + tests de RLS en un PostgreSQL local desechable (sin Docker) |
| `npm run db:types`                | Genera tipos TS desde Supabase local                                                    |

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
  Las órdenes guardan un _snapshot_ del desglose: precio, envío, comisión, fees de pago, neto vendedor, neto plataforma.
  El cálculo vive en `src/lib/pricing.ts` (con tests).
- **Público vs privado por tabla.** `profiles` es público; email, teléfono, Stripe y direcciones viven en
  `private_profiles` / `addresses`, visibles solo para el dueño (y admin).
- **Seguridad en la base de datos, no en el frontend.** RLS en todas las tablas + _grants por columna_:
  un usuario no puede cambiar `status`, `role`, contadores ni ids de Stripe aunque llame a la API directamente.
  Publicar pasa por la RPC `publish_listing` (valida fotos, etapa, envío permitido y moderación).
  Órdenes, pagos y movimientos de saldo solo los escribe el servidor (service role / RPCs `security definer`).
- **Edad por categoría (`categories.age_mode`, editable en Admin):** _Sin etapa_ (muebles, accesorios…) no pregunta
  la edad y se guarda como "Todas las edades" (lo fuerza un trigger); _Orientativa_ (juguetes, zapatos, carriolas…)
  pide un rango "desde – hasta" que se guarda como etapas contiguas; _Exacta_ (ropa) pide etapas puntuales.
  Filtrar por etapa incluye los productos "Todas las edades", después de los de esa etapa (`listings.is_all_ages`).
  Lógica en `src/lib/domain/age-mode.ts` (con tests).
- **Búsqueda:** PostgreSQL Full Text Search en español sin acentos (`es_unaccent`), con pesos
  título/marca/modelo > categoría > descripción.
- **Storage:** buckets `listing-images` (10 MB) y `avatars` (2 MB), solo JPEG/PNG/WebP, escritura solo en la carpeta propia.
- Las migraciones futuras que creen funciones deben revocar `execute` a `anon/authenticated`
  y otorgarlo explícitamente (Supabase lo concede por defecto).
- **Rendimiento:** la analítica de servidor (`track`) y el contador de vistas se envían con `after()`, después de
  responder. Filtros de ciudad y marca usan índices trigram (`pg_trgm`).
- **SEO:** `sitemap.xml` (categorías + productos activos, cada hora), `robots.txt` que excluye rutas privadas,
  Open Graph del sitio (`src/app/opengraph-image.png`) y por producto, y datos estructurados `Product` en cada producto.
  Las URLs absolutas salen de `NEXT_PUBLIC_SITE_URL`: cámbiala al conectar el dominio propio.
- **Sin `loading.tsx` global a propósito:** haría streaming de todas las páginas y los `notFound()`/`redirect()`
  responderían 200 en vez de 404/307.

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
- [x] **7. Checkout:** el comprador elige entrega (+ dirección), paga con su saldo y/o en Stripe Checkout;
      el producto queda reservado mientras paga y vendido al confirmarse el pago (webhook firmado e idempotente).
      La plataforma cobra y retiene; el vendedor recibe saldo al completarse la orden (ver "Saldo y retiros").
      Reembolso automático si un pago llega después de liberar la reserva. `/orders` y `/orders/[id]` básicos.
- [x] **8. Órdenes:** el vendedor marca enviado (con guía) o entregado; el comprador confirma o reporta un problema
      (congela la orden y el pago). Si no hay respuesta en `order_auto_complete_days` (3) días tras "entregado", se
      completa sola (al abrir la orden y con el job diario `/api/cron/orders`). Al completar, el neto pasa al saldo
      del vendedor.
      Reseñas en ambos sentidos, perfil público `/profile/[username]`, avisos en la app y contacto entre las partes
      tras el pago.
- [x] **9. Admin (`/admin`):** métricas (GMV, revenue, revenue neto, take rate, sell-through, días hasta venta,
      ticket promedio) con alertas de pendientes; productos (buscar, filtrar, aprobar, rechazar, editar, desactivar,
      reactivar, marcar vendido); usuarios (buscar por nombre/usuario/correo, suspender pausando sus productos,
      reactivar); pedidos (filtrar, resolver problemas a favor de comprador —reembolso— o vendedor —completar y
      acreditar saldo—); retiros semanales (CSV, pagado / no pagado); configuración (comisiones, umbral concierge,
      moderación, fotos, días de confirmación, retiro mínimo) y categorías. Toda acción queda en `admin_audit_log`.
- [x] **Vendedores gestionados:** importación masiva desde CSV (perfiles sin acceso operados por admins).
- [x] **Saldo:** ventas → saldo; comprar con saldo (+ tarjeta); retiros a CLABE los martes (corte viernes).
- [x] **Crece con tus bebés:** los padres registran a sus bebés (nombre + fecha de nacimiento o de parto; privado).
      La app calcula su etapa (Embarazo, RN = primer mes, 0–3 meses, …) con fechas de calendario (`src/features/babies/stages.ts`, con tests) y el inicio muestra:
      selector de bebés, línea de tiempo de etapas, "Le queda chico" (vender lo de la etapa anterior con la edad
      preseleccionada), más productos de su etapa actual. Base del futuro Baby Closet.
- [ ] 10. P1: favoritos, chat, wishlist, IA para listings, concierge

Las rutas de etapas futuras (`/sell/new`, `/search`, `/listing/[id]`, …) existen como placeholders.
