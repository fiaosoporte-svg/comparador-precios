// API del comparador de precios (Node + Express). Se publica en Render.
//
// Rutas para la app (header x-api-key: API_KEY_APP):
//   GET  /categorias                         categorías agrupadas
//   GET  /precios/:categoria?forzar=true     precios en vivo de una categoría, del más barato al más caro
//   GET  /productos/buscar?q=arroz&tienda=d1 búsqueda por nombre
//   GET  /productos/codigo/:ean              mismo producto en varias tiendas
//   GET  /productos?ids=1,2,3                varios productos (lista de compras)
//   GET  /productos/:id/similares            mismo producto en otras tiendas y alternativas más baratas
//   GET  /productos/:id/historial            cambios de precio
//   GET  /tiendas/estado                     última actualización de cada tienda
//   GET  /promociones?tienda=ara&vence_en_dias=2  promociones con fecha de vigencia
//   GET  /ara/folleto                        folleto semanal de Ara (PDF) para verlo en la app
// Rutas públicas (sin clave):
//   GET  /app/version?build=3                ¿hay versión nueva de la app? (la app lo consulta al abrir)
//   GET  /descargar                          página para descargar e instalar la app
//   GET  /descargas/<archivo>.apk            APK de cada versión
// Rutas de administración (header x-admin-token: ADMIN_TOKEN):
//   POST /admin/actualizar/d1 | /admin/actualizar/megaredil?lote=8 | /admin/actualizar/ara?forzar=true
import express, { NextFunction, Request, Response } from "express";
import { db } from "./db.js";
import { buscarProductos, compararPorCodigo, historial, NoEncontrado, preciosCategoria, productosPorIds, promociones, similares } from "./precios.js";
import { actualizarAra, actualizarD1, actualizarMegaredil, araConOcr, iniciarTareas, revisarVencimientos } from "./tareas.js";
import { folletoVigente } from "./tiendas/ara.js";
import { CARPETA_DESCARGAS, estadoActualizacion, paginaDescarga } from "./versiones.js";

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", true); // Render está detrás de un proxy: req.protocol = https
app.use(express.json());

// CORS: la versión web de la app (flutter build web) llama la API desde otro dominio.
// CORS_ORIGENES="https://mi-app.web.app,http://localhost:8080" limita los orígenes; vacío = cualquiera.
app.use((req, res, next) => {
  const permitidos = (process.env.CORS_ORIGENES ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const origen = req.get("origin");
  if (origen && (!permitidos.length || permitidos.includes(origen))) {
    res.setHeader("Access-Control-Allow-Origin", origen);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "content-type, x-api-key, x-admin-token");
    res.setHeader("Access-Control-Max-Age", "86400");
  }
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

const baseUrl = (req: Request) => process.env.URL_PUBLICA ?? `${req.protocol}://${req.get("host")}`;

// --- versiones de la app (públicas: la app las consulta antes de tener la clave configurada) ---
app.use("/descargas", express.static(CARPETA_DESCARGAS, {
  setHeaders: (res, ruta) => {
    if (ruta.endsWith(".apk")) {
      res.setHeader("Content-Type", "application/vnd.android.package-archive");
      res.setHeader("Content-Disposition", `attachment; filename="${ruta.split(/[\/]/).pop()}"`);
    }
  },
}));
app.get("/app/version", async (req, res) => {
  res.json({ ok: true, ...(await estadoActualizacion(Number(req.query.build ?? 0), baseUrl(req))) });
});
app.get("/descargar", async (req, res) => {
  res.type("html").send(await paginaDescarga(baseUrl(req)));
});

// --- seguridad mínima por clave ---
function exigir(header: string, variable: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const esperado = process.env[variable];
    if (!esperado) return next(); // sin clave configurada (desarrollo local) no se exige
    if (req.get(header) !== esperado) return res.status(401).json({ ok: false, error: "no autorizado" });
    next();
  };
}
const app_ = exigir("x-api-key", "API_KEY_APP");
const admin = exigir("x-admin-token", "ADMIN_TOKEN");

// --- rutas públicas ---
app.get("/", (_req, res) => res.json({ ok: true, servicio: "comparador-precios-api" }));
app.get("/salud", async (_req, res) => {
  const { error } = await db().from("tiendas").select("id").limit(1);
  res.status(error ? 503 : 200).json({ ok: !error, db: error ? error.message : "ok" });
});

// --- rutas de la app ---
app.get("/categorias", app_, async (_req, res) => {
  // "Otros productos" va al final (orden 1000): así ningún producto queda sin poder verse
  const { data, error } = await db().from("categorias").select("*").order("orden");
  if (error) throw error;
  const grupos: Record<string, unknown[]> = {};
  for (const c of data ?? []) (grupos[c.grupo] ??= []).push(c);
  res.json({ ok: true, grupos });
});

app.get("/precios/:categoria", app_, async (req, res) => {
  const r = await preciosCategoria(String(req.params.categoria), { forzar: req.query.forzar === "true", vivo: req.query.vivo !== "false" });
  res.json({ ok: true, ...r });
});

app.get("/productos/buscar", app_, async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  if (q.length < 2) return res.status(400).json({ ok: false, error: "q debe tener al menos 2 letras" });
  res.json({ ok: true, productos: await buscarProductos(q, req.query.tienda as string | undefined, Number(req.query.limite ?? 50)) });
});

app.get("/productos/codigo/:ean", app_, async (req, res) => {
  res.json({ ok: true, productos: await compararPorCodigo(String(req.params.ean)) });
});

app.get("/productos", app_, async (req, res) => {
  const ids = String(req.query.ids ?? "").split(",").map(Number);
  res.json({ ok: true, productos: await productosPorIds(ids) });
});

app.get("/productos/:id/similares", app_, async (req, res) => {
  res.json({ ok: true, ...(await similares(Number(req.params.id))) });
});

app.get("/productos/:id/historial", app_, async (req, res) => {
  res.json({ ok: true, historial: await historial(Number(req.params.id)) });
});

app.get("/tiendas/estado", app_, async (_req, res) => {
  const { data: tiendas } = await db().from("tiendas").select("*");
  const { data: refrescos } = await db().from("refrescos").select("tienda_id, ultimo, error").order("ultimo", { ascending: false, nullsFirst: false });
  const estado = (tiendas ?? []).map((t) => {
    const r = (refrescos ?? []).filter((x) => x.tienda_id === t.id);
    return { ...t, ultima_actualizacion: r[0]?.ultimo ?? null, errores_recientes: r.filter((x) => x.error).length };
  });
  res.json({ ok: true, tiendas: estado });
});

app.get("/promociones", app_, async (req, res) => {
  const dias = req.query.vence_en_dias !== undefined ? Number(req.query.vence_en_dias) : undefined;
  res.json({ ok: true, promociones: await promociones({ tienda: req.query.tienda as string | undefined, venceEnDias: dias }) });
});

// --- folleto de Ara ---
// Ara no publica catálogo: solo un folleto semanal en PDF. Aquí solo se busca su dirección (sin descargarlo
// ni leerlo con OCR); la app lo descarga y lo muestra página por página.
app.get("/ara/folleto", app_, async (_req, res) => {
  const f = await folletoVigente();
  if (!f) return res.status(404).json({ ok: false, error: "Ara no tiene folleto publicado en este momento" });
  res.json({ ok: true, ...f });
});

// --- administración ---
app.post("/admin/actualizar/d1", admin, async (_req, res) => res.json({ ok: true, resultado: await actualizarD1() }));
app.post("/admin/actualizar/megaredil", admin, async (req, res) =>
  res.json({ ok: true, resultado: await actualizarMegaredil(Math.min(Number(req.query.lote ?? 8), 30)) }));
app.post("/admin/actualizar/ara", admin, async (req, res) => {
  if (!araConOcr()) return res.status(409).json({ ok: false, error: "OCR de Ara desactivado (ARA_OCR=true para activarlo; necesita ~600 MB)" });
  res.json({ ok: true, resultado: await actualizarAra(req.query.forzar === "true") });
});
app.post("/admin/revisar-vencimientos", admin, async (_req, res) => res.json({ ok: true, resultado: await revisarVencimientos() }));

// --- errores (Express 5 captura los errores de funciones async) ---
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof NoEncontrado) return res.status(404).json({ ok: false, error: err.message });
  console.error(err);
  res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
});

const puerto = Number(process.env.PORT ?? 3000);
app.listen(puerto, () => {
  console.log(`API escuchando en el puerto ${puerto}`);
  if (process.env.TAREAS_PROGRAMADAS === "true") iniciarTareas();
});
