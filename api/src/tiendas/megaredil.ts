// Megaredil (Bucaramanga): HTML por categoría. El listado general /es/tienda repite productos
// entre páginas, por eso siempre se recorre por categoría (/es/categoria/<slug>).
import { db, espera, fetchConReintentos, guardarProductos, marcarRefresco, ProductoFila } from "../db.js";
import { categorizar } from "../categorias.js";
import { aUnidad, precioComparable, tamanoDesdeTexto, Tamano } from "../normalizar.js";

const BASE = "https://megaredil.com";
const PAUSA_MS = 700; // no saturar el sitio

const CARD = /<div id="(\d+)" class="card-product[^"]*" data-price="([\d.]+)" data-availability="([^"]*)" data-brand="([^"]*)" data-discount="([^"]*)">([\s\S]*?)(?=<div id="\d+" class="card-product|$)/g;

const html = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();

/** "<strong>x 2500 Gramos</strong>", "x 12 Rollos", "x 6 Unidades x 110 Gramos" */
function tamanoTarjeta(txt: string | undefined, nombre: string): Tamano | null {
  if (txt) {
    const multi = txt.match(/([\d.,]+)\s*unidades\s*x\s*([\d.,]+)\s*(\w+)/i);
    if (multi) {
      const base = aUnidad(Number(multi[2].replace(",", ".")), multi[3]);
      if (base) return { cantidad: base.cantidad * Number(multi[1]), unidad: base.unidad };
    }
    const m = txt.match(/([\d.,]+)\s*([a-záéíóú]+)/i);
    if (m) {
      const t = aUnidad(Number(m[1].replace(/\.(?=\d{3}\b)/g, "").replace(",", ".")), m[2]);
      if (t) return t;
    }
  }
  return tamanoDesdeTexto(nombre);
}

export function parsearPagina(pagina: string, slug: string): ProductoFila[] {
  const filas: ProductoFila[] = [];
  for (const [, id, precio, disp, marca, desc, cuerpo] of pagina.matchAll(CARD)) {
    const nombre = html(cuerpo.match(/<h3 class="title">([\s\S]*?)<\/h3>/)?.[1] ?? "");
    if (!nombre) continue;
    const img = cuerpo.match(/class="lazyload img-product" data-src="([^"]+)"/)?.[1];
    const slugProd = cuerpo.match(/data-src="\/es\/productos\/quick\/([^"]+)"/)?.[1];
    const tamTxt = cuerpo.match(/<strong>\s*x\s*([^<]+?)\s*<\/strong>/)?.[1];
    const imagen = img ? BASE + html(img) : null;
    const ean = imagen?.match(/\/(\d{8,14})[^/]*\.(?:jpe?g|png|webp)/i)?.[1] ?? null;
    const tam = tamanoTarjeta(tamTxt, nombre);
    const p = Math.round(Number(precio));
    filas.push({
      tienda_id: "megaredil",
      id_externo: id,
      nombre,
      marca: marca && marca !== "Sin marca" ? marca : null,
      codigo_barras: ean,
      categoria_id: categorizar(nombre),
      categoria_tienda: slug,
      categoria_tienda_ref: slug,
      cantidad: tam?.cantidad ?? null,
      unidad: tam?.unidad ?? null,
      precio: p,
      precio_regular: null,
      promo: desc === "true" ? "Descuento" : null,
      precio_comparable: precioComparable(p, tam),
      disponible: disp === "In stock",
      imagen_url: imagen,
      url: slugProd ? `${BASE}/es/productos/${slugProd}` : null,
    });
  }
  return filas;
}

/** Descarga todas las páginas de una categoría. */
async function categoria(slug: string): Promise<ProductoFila[]> {
  const vistos = new Map<string, ProductoFila>();
  for (let page = 1; page < 100; page++) {
    const r = await fetchConReintentos(`${BASE}/es/categoria/${slug}?page=${page}&per_page=30`);
    const nuevos = parsearPagina(await r.text(), slug).filter((f) => !vistos.has(f.id_externo));
    if (!nuevos.length) break;
    nuevos.forEach((f) => vistos.set(f.id_externo, f));
    await espera(PAUSA_MS);
  }
  return [...vistos.values()];
}

export async function refrescarMegaredil(slugs: string[]): Promise<number> {
  let total = 0;
  for (const slug of slugs) {
    try {
      const filas = await categoria(slug);
      // Un producto aparece en varias categorías (padre e hija): conservar la categoría ya guardada
      // si es más específica se resuelve en la consulta; aquí solo se actualizan precio y datos.
      const n = await guardarProductos(filas);
      await marcarRefresco("megaredil", slug, n);
      total += n;
    } catch (e) {
      await marcarRefresco("megaredil", slug, 0, String(e));
    }
  }
  return total;
}

/** Lista de categorías publicada en la tienda; registra las nuevas en `refrescos`. */
export async function sincronizarCategorias(): Promise<string[]> {
  const r = await fetchConReintentos(`${BASE}/es/tienda`);
  const slugs = [...new Set([...(await r.text()).matchAll(/href="\/es\/categoria\/([^"?#]+)"/g)].map((m) => m[1]))];
  const filas = slugs.map((ref) => ({ tienda_id: "megaredil", ref }));
  await db().from("refrescos").upsert(filas, { onConflict: "tienda_id,ref", ignoreDuplicates: true });
  return slugs;
}

/** Las N categorías que hace más tiempo no se refrescan (rotación continua). */
export async function categoriasMasViejas(n: number): Promise<string[]> {
  const { data, error } = await db()
    .from("refrescos")
    .select("ref")
    .eq("tienda_id", "megaredil")
    .order("ultimo", { ascending: true, nullsFirst: true })
    .limit(n);
  if (error) throw error;
  return (data ?? []).map((r) => r.ref);
}
