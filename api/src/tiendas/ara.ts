// Ara solo publica un folleto de ofertas semanal en PDF (folleto-ahorro-sNN.pdf).
import { extraerFolleto, FolletoLeido } from "./ara-pdf.js";
import { db, fetchConReintentos, guardarProductos, marcarRefresco, ProductoFila } from "../db.js";
import { categorizar } from "../categorias.js";
import { aUnidad, precioComparable, sinTildes, tamanoDesdeTexto } from "../normalizar.js";

const PAGINA_OFERTAS = "https://aratiendas.com/ahorro-ara/";
const MEDIA = "https://sitemedia.aratiendas.com/wp-content/uploads";

// ---------- 1. Encontrar el folleto vigente ----------

function semanaISO(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const inicio = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - inicio.getTime()) / 86_400_000 + 1) / 7);
}

const semanaDe = (url: string) => Number(url.match(/-s(\d+)\.pdf$/i)?.[1] ?? 0);

/** Devuelve la URL del folleto más reciente publicado (o null). */
export async function buscarFolletoVigente(): Promise<string | null> {
  const candidatos = new Set<string>();
  // a) enlaces publicados en la página de ofertas
  try {
    const html = await (await fetchConReintentos(PAGINA_OFERTAS, 2)).text();
    for (const m of html.matchAll(/https?:\/\/[^"' ]+folleto-ahorro-s\d+\.pdf/gi)) candidatos.add(m[0]);
  } catch { /* si la página falla, se prueban las URLs por patrón */ }
  // b) el patrón conocido: /AAAA/MM/folleto-ahorro-sSEMANA.pdf (semana actual y siguiente, este mes y el anterior)
  const hoy = new Date();
  const semana = semanaISO(hoy);
  for (const delta of [0, -1]) {
    const f = new Date(hoy.getFullYear(), hoy.getMonth() + delta, 1);
    const carpeta = `${MEDIA}/${f.getFullYear()}/${String(f.getMonth() + 1).padStart(2, "0")}`;
    for (const s of [semana + 1, semana]) {
      const url = `${carpeta}/folleto-ahorro-s${s}.pdf`;
      const r = await fetch(url, { method: "HEAD" }).catch(() => null);
      if (r?.ok) candidatos.add(url);
    }
  }
  return [...candidatos].sort((a, b) => semanaDe(b) - semanaDe(a))[0] ?? null;
}

// ---------- 2. Leer el folleto ----------
// Sin IA ni servicios externos: texto del PDF + posiciones, y OCR local en las páginas que son imagen.
// Ver ara-pdf.ts y ocr.ts.

// ---------- 3. Guardar ----------

const slug = (s: string) => sinTildes(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
const fechaValida = (s: string) => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null);

export function aFilas(folleto: FolletoLeido, url: string): ProductoFila[] {
  const semana = semanaDe(url);
  return folleto.productos
    .filter((p) => p.precio_unitario > 0)
    .map((p) => {
      const tam = (p.unidad && p.cantidad > 0 ? aUnidad(p.cantidad, p.unidad) : null) ?? tamanoDesdeTexto(p.nombre);
      return {
        tienda_id: "ara",
        id_externo: `s${semana}-${slug(p.nombre)}`,
        nombre: p.nombre,
        categoria_id: categorizar(p.nombre),
        categoria_tienda: `Folleto semana ${semana}`,
        categoria_tienda_ref: url,
        cantidad: tam?.cantidad ?? null,
        unidad: tam?.unidad ?? null,
        precio: p.precio_unitario,
        precio_regular: p.precio_regular > 0 ? p.precio_regular : null,
        promo: p.promo || null,
        precio_comparable: precioComparable(p.precio_unitario, tam),
        disponible: true,
        vigente_desde: fechaValida(folleto.vigente_desde),
        vigente_hasta: fechaValida(folleto.vigente_hasta),
        imagen_url: null, // la app muestra el logo de Ara
        url,
      };
    });
}

/** Busca el folleto vigente y, si es nuevo (o forzar), lo procesa. */
export async function refrescarAra(forzar = false): Promise<{ url: string | null; productos: number; nuevo: boolean }> {
  const url = await buscarFolletoVigente();
  if (!url) return { url: null, productos: 0, nuevo: false };

  const { data: previo } = await db().from("refrescos").select("ultimo, error").eq("tienda_id", "ara").eq("ref", url).maybeSingle();
  if (previo?.ultimo && !previo.error && !forzar) return { url, productos: 0, nuevo: false };

  try {
    const pdf = await (await fetchConReintentos(url)).arrayBuffer();
    const filas = aFilas(await extraerFolleto(pdf), url);
    // las ofertas de folletos anteriores dejan de estar disponibles
    await db().from("productos").update({ disponible: false }).eq("tienda_id", "ara").neq("categoria_tienda_ref", url);
    const n = await guardarProductos(filas);
    await marcarRefresco("ara", url, n);
    return { url, productos: n, nuevo: true };
  } catch (e) {
    await marcarRefresco("ara", url, 0, String(e));
    throw e;
  }
}
