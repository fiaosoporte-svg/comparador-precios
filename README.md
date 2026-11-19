# Comparador de precios Bucaramanga

Compara precios de **D1**, **Megaredil** y **Ara** por categoría y por precio por 100 g / 100 ml / unidad.

```
App Flutter (Android)  ──x-api-key──►  API Node (Render)  ──service role──►  Supabase (Postgres)
                                           │
                                           ├─ D1: API VTEX pública (al instante)
                                           ├─ Megaredil: HTML por categoría (rotación cada 5 min + al pedir)
                                           └─ Ara: folleto PDF semanal, texto del PDF + OCR local (sin IA, sin claves)
```

## Carpetas

| Carpeta | Qué hay |
|---|---|
| `api/` | API en Node + Express + TypeScript (se publica en Render) |
| `supabase/migrations/` | Esquema de la base de datos |
| `render.yaml` | Configuración de despliegue en Render |
| `scripts_prototipo/` | Scripts Python del prototipo (referencia) |
| `app/` | App Flutter (Android y web) |

## Qué tan "en vivo" está cada tienda

| Tienda | Al pedir una categoría desde la app | Automático en segundo plano |
|---|---|---|
| D1 | Si el dato tiene más de 60 s, se consulta D1 en ese momento (~1 s) | Catálogo completo cada 30 min |
| Megaredil | Si tiene más de 10 min, se descargan sus categorías en ese momento (segundos) | 8 categorías cada 5 min (todo el catálogo ~cada 2 h) |
| Ara | — (solo publica un folleto semanal) | Busca folleto nuevo cada hora; cuando una oferta vence o vence hoy, revisa cada 15 min |

## Puesta en marcha

### 1. Supabase
1. Crea un proyecto en https://supabase.com.
2. En **SQL Editor** ejecuta, en orden, los archivos de `supabase/migrations/`
   (o con la CLI: `npx supabase login`, `npx supabase link --project-ref TU_REF`, `npx supabase db push`).
3. Copia de **Project Settings > API**: la URL y la clave `service_role` (secreta).

### 2. Probar la API en tu PC
```bash
cd api
cp .env.example .env     # y llena los valores
npm install
npm test                 # pruebas de parseo contra las tiendas reales
npm run dev              # http://localhost:3000
```
Primera carga de datos:
```bash
curl -X POST http://localhost:3000/admin/actualizar/d1
curl -X POST "http://localhost:3000/admin/actualizar/megaredil?lote=30"   # repetir hasta cubrir las ~177 categorías
curl -X POST http://localhost:3000/admin/actualizar/ara
curl http://localhost:3000/precios/arroz
```

### 3. Render
1. Sube este repositorio a GitHub.
2. En Render: **New > Blueprint** y elige el repositorio (usa `render.yaml`).
3. Escribe `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`. `ADMIN_TOKEN` y `API_KEY_APP` se generan solos; copia `API_KEY_APP` para la app.

> El plan gratis de Render duerme el servicio tras 15 min sin tráfico: las tareas programadas se detienen
> y la primera petición tarda ~50 s. Para precios al día usa el plan Starter, o deja `TAREAS_PROGRAMADAS=false`
> y llama `/admin/actualizar/*` desde un Cron Job de Render.

## API

Todas las rutas de la app requieren el header `x-api-key: <API_KEY_APP>`.

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/salud` | Estado del servicio y la base de datos (sin clave) |
| GET | `/categorias` | Categorías agrupadas (Despensa, Lácteos, Aseo...) |
| GET | `/precios/:categoria?forzar=true` | Precios en vivo de la categoría, del más barato al más caro, y el mejor de cada tienda |
| GET | `/productos/buscar?q=arroz&tienda=d1` | Búsqueda por nombre |
| GET | `/productos/codigo/:ean` | Mismo producto (código de barras) en varias tiendas |
| GET | `/productos?ids=1,2,3` | Varios productos por id (la lista de compras actualiza sus precios) |
| GET | `/productos/:id/similares` | Mismo producto en otras tiendas (código de barras) y alternativas más baratas de su categoría |
| GET | `/productos/:id/historial` | Cambios de precio |
| GET | `/tiendas/estado` | Última actualización de cada tienda |
| GET | `/promociones?tienda=ara&vence_en_dias=2` | Promociones con fecha de vigencia, las que vencen primero |
| GET | `/app/version?build=3` | ¿Hay versión nueva de la app? (sin clave) |
| GET | `/descargar` | Página para instalar la app desde el celular (sin clave) |
| POST | `/admin/actualizar/d1` · `/megaredil?lote=8` · `/ara?forzar=true` · `/admin/revisar-vencimientos` | Actualización manual (header `x-admin-token`) |

Ejemplo de respuesta de `/precios/arroz`:
```json
{
  "ok": true,
  "categoria": { "id": "arroz", "nombre": "Arroz", "unidad_comparacion": "100g" },
  "refrescado": { "d1": ["1/16"] },
  "mejor_por_tienda": {
    "d1":        { "nombre": "Arroz Económico Albar 2000 Grs", "precio": 5550, "precio_comparable": 277.5 },
    "ara":       { "nombre": "Arroz Del Costal x 3.000 g",     "precio": 9780, "precio_comparable": 326, "vigente_hasta": "2026-11-25" },
    "megaredil": { "nombre": "Arroz Sonora", "precio": 8400, "precio_comparable": 336 }
  },
  "productos": [ ... ]
}
```

## La app (sin login)

| Pestaña | Qué hace |
|---|---|
| Categorías | Elige una categoría: el más barato de cada tienda y todos los productos por precio por 100 g / 100 ml / unidad |
| Buscar | Búsqueda por palabras en cualquier orden, con filtro por tienda |
| Ofertas | Promociones con fecha de vigencia (folleto de Ara), las que vencen primero |
| Mi lista | Lista de compras guardada en el celular: cantidades, marcar comprado, total por tienda, actualizar precios |

Al tocar un producto se abre su detalle: historial de precio con gráfica, el mismo producto en otras tiendas y
alternativas más baratas (con botón para cambiarla en la lista). El ícono de tienda arriba muestra cuándo se actualizó cada tienda.

No hay cuentas: la lista se guarda en el dispositivo (Android: SharedPreferences mediante `MainActivity.kt`;
web: `localStorage`), sin paquetes extra.

```bash
# Android (tu celular conectado por USB)
flutter run --dart-define=API_URL=http://IP-DE-TU-PC:3000

# Web (la primera vez crea la carpeta web/ con: flutter create --platforms web .)
flutter run -d chrome --dart-define=API_URL=http://localhost:3000
```
Para la web, la API responde CORS. Con `CORS_ORIGENES` (separados por coma) se limita qué dominios pueden llamarla.

## Vigencia de las promociones

Cada producto de la API trae:

| Campo | Significado |
|---|---|
| `vigente_desde`, `vigente_hasta` | Fechas de la promoción (Ara las publica en el folleto; D1 y Megaredil no publican fechas) |
| `vence_en_dias` | Días que faltan (0 = vence hoy) |
| `estado_vigencia` | `proxima`, `vigente`, `vence_hoy`, `vencida` o `sin_fecha` |
| `minutos_desde_actualizacion` | Qué tan fresco es el precio |

La tarea de vencimientos (cada 15 min) marca como no disponibles las ofertas vencidas y busca el folleto nuevo.

## Folleto de Ara sin IA

`api/src/tiendas/ara-pdf.ts` lee el texto real del PDF con su posición y tamaño de letra y empareja cada precio grande
con el nombre más cercano (detecta "Lleva 6 por", "3x2", "2da unidad", "precio por libra"). Las páginas que son solo
imagen pasan por OCR local con Tesseract (`ocr.ts`): los precios amarillos sobre rojo se aíslan por color antes de leerlos.
Con el folleto de la semana 47: **112/113 productos correctos, 0 precios errados** (`npm run evaluar-folleto`).
En las páginas de imagen algunos nombres pueden salir incompletos; el precio sí es exacto.

## Versiones de la app

Los APK y el registro (`versiones.json`) viven en `api/public/descargas/` y Render los publica en cada despliegue.

```bash
# 1. sube la versión en app/pubspec.yaml: version: 1.2.0+5   (el número después del + siempre aumenta)
cd app && flutter build apk --release
cd ../api && npm run publicar-version -- --notas "Qué cambió" [--obligatoria]
git add . && git commit -m "App 1.2.0" && git push
```

La app consulta `/app/version?build=<su build>` al abrir: si hay versión nueva muestra los cambios y un botón para
descargar e instalar; si alguna versión pendiente es `--obligatoria`, no deja seguir sin actualizar.
Primera instalación: abrir `https://<tu-servicio>.onrender.com/descargar` en el celular.
