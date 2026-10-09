# SEO, analítica y velocidad: lista de acciones

Lo que ya hace el código está marcado ✅. Lo demás son pasos tuyos, en orden de impacto.

## Ya está en el sitio ✅

- `sitemap.xml` (inicio, explorar, categorías activas, productos activos, ayuda y legales; se regenera cada hora)
  y `robots.txt` que excluye rutas privadas (cuenta, pedidos, admin, checkout…).
- Título, descripción y URL canónica en cada página pública; Open Graph (vista previa al compartir en WhatsApp,
  Facebook, etc.) con la foto del producto.
- Búsquedas y filtros (`/search?q=…`, `/category/ropa?gender=girl`) llevan `noindex, follow`: Google no indexa
  miles de combinaciones casi iguales, solo la página base.
- Datos estructurados (schema.org): **Product** en cada producto (precio, estado nuevo/usado, disponible/vendido,
  envío fijo a México, sin devoluciones) y **Organization + WebSite** en el inicio (logo, buscador).
- Verificación de propiedad por etiqueta HTML: variables `GOOGLE_SITE_VERIFICATION` y `BING_SITE_VERIFICATION`.
- Velocidad: Vercel **Speed Insights** (datos reales de visitantes) y **Web Analytics** (visitas, sin cookies).
- Eventos de negocio en PostHog (registro, publicación, búsqueda, compra, venta completada, retiros).

## 1. Google Search Console (lo primero; gratis)

1. Entra a [search.google.com/search-console](https://search.google.com/search-console) → **Agregar propiedad**.
2. Elige **Dominio** → `mercadito.baby` → copia el registro **TXT** y agrégalo en el DNS de tu dominio. (Cubre
   `www`, `http` y `https`). Alternativa: propiedad de **Prefijo de URL** `https://mercadito.baby` → método
   **Etiqueta HTML** → copia solo el valor de `content="…"` en Vercel como `GOOGLE_SITE_VERIFICATION` → Redeploy →
   Verificar.
3. **Sitemaps** → agrega `https://mercadito.baby/sitemap.xml`.
4. **Inspección de URLs** → pega la del inicio y 3–5 productos → **Solicitar indexación**.
5. Revisa cada semana: **Páginas** (qué se indexó y por qué no), **Mejoras → Fragmentos de productos /
   Fichas de comerciante** (errores de datos estructurados) y **Métricas web principales**.

## 2. Bing Webmaster Tools (5 minutos; también alimenta a ChatGPT y Copilot)

[bing.com/webmasters](https://www.bing.com/webmasters) → **Importar desde Google Search Console** (lo más rápido) o
etiqueta HTML en `BING_SITE_VERIFICATION`. Agrega el mismo sitemap.

## 3. Google Business Profile y Merchant Center

- **Merchant Center** ([merchants.google.com](https://merchants.google.com)): con el dominio verificado, Google
  puede tomar los productos de la página (datos estructurados) y mostrarlos gratis en la pestaña **Shopping**.
  Configura envío (precio fijo) y política de devoluciones igual que en el sitio.
- **Business Profile**: solo si tendrán bodega o punto de entrega con atención al público.

## 4. Analítica

1. Vercel → proyecto → **Analytics** → **Enable** (Web Analytics; el código ya está). Muestra visitas, páginas,
   de dónde llegan (Google, Instagram, WhatsApp…) y países, sin banner de cookies.
2. **Speed Insights** ya está activo: Vercel → **Speed Insights**. Meta: LCP < 2.5 s, INP < 200 ms, CLS < 0.1
   en móvil.
3. **PostHog** (embudos de negocio): confirma que `NEXT_PUBLIC_POSTHOG_KEY` esté en Vercel. Crea un embudo
   _visita producto → inicia compra → pago confirmado_ y otro de vendedores _registro → producto publicado →
   venta completada_.
4. ¿Google Analytics 4? Solo si vas a anunciarte en Google/Meta Ads (para medir conversiones). Usa cookies: habría
   que agregar un aviso de cookies y actualizar el Aviso de privacidad. Pídemelo cuando llegue ese momento.

## 5. Pruebas de velocidad (antes de anunciar y después de cada cambio grande)

- [PageSpeed Insights](https://pagespeed.web.dev): prueba en **Móvil** el inicio, una categoría y un producto.
  Lo importante es la sección de arriba (_datos de usuarios reales_); el puntaje de laboratorio varía.
- [Rich Results Test](https://search.google.com/test/rich-results): pega la URL de un producto → debe detectar
  **Producto** sin errores.
- Vista previa al compartir: pega un link de producto en WhatsApp o en
  [opengraph.xyz](https://www.opengraph.xyz) → debe verse foto, título y precio.

## 6. Contenido que posiciona (lo que más mueve la aguja)

- **Títulos de producto descriptivos**: tipo + marca + talla/edad + detalle ("Pijama Carter's 6–9 meses
  algodón"). Es lo que la gente escribe en Google.
- **Fotos reales y suficientes**: Google Imágenes trae tráfico; la primera foto es la que se ve en resultados.
- **Descripción de 2–3 líneas** en cada producto (estado, talla, medidas).
- **Página de "Cómo funciona"/blog** más adelante: guías como "tabla de tallas de bebé por edad",
  "qué ropa necesita un recién nacido", "cómo vender ropa de bebé usada". Son búsquedas frecuentes y
  atraen a padres que luego compran o venden.
- **Links hacia el sitio**: perfil de Instagram/TikTok/Facebook con link, grupos de mamás, directorios locales.
  Cada mención con link ayuda.

## 7. Revisión mensual

- Search Console → **Rendimiento**: consultas con muchas impresiones y pocos clics (mejorar títulos) y páginas que
  bajan.
- Vercel Analytics: de dónde llega la gente y qué páginas abandonan.
- PostHog: en qué paso del embudo se cae más gente.
