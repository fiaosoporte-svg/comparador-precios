// Tiendas en la plataforma Parze (Megaredil y Todorapidas, Bucaramanga): HTML por categoría.
// El listado general /es/tienda repite productos entre páginas, por eso siempre se recorre por
// categoría (/es/categoria/<slug>). Sus robots.txt permiten estas páginas (no se usa /api ni la búsqueda).
import { db, espera, fetchConReintentos, guardarProductos, marcarRefresco, ProductoFila } from "../db.js";
import { categorizar } from "../categorias.js";
import { aUnidad, precioComparable, tamanoDesdeTexto, Tamano } from "../normalizar.js";

export interface TiendaParze { id: string; base: string }

export const MEGAREDIL: TiendaParze = { id: "megaredil", base: "https://megaredil.com" };
export const TODORAPIDAS: TiendaParze = { id: "todorapidas", base: "https://todorapidas.com" };

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

export function parsearPagina(pagina: string, slug: string, tienda: TiendaParze = MEGAREDIL): ProductoFila[] {
  const filas: ProductoFila[] = [];
  for (const [, id, precio, disp, marca, desc, cuerpo] of pagina.matchAll(CARD)) {
    const nombre = html(cuerpo.match(/<h3 class="title">([\s\S]*?)<\/h3>/)?.[1] ?? "").replace(/\s+/g, " ");
    if (!nombre) continue;
    const img = cuerpo.match(/class="lazyload img-product" data-src="([^"]+)"/)?.[1];
    const slugProd = cuerpo.match(/data-src="\/es\/productos\/quick\/([^"]+)"/)?.[1];
    const tamTxt = cuerpo.match(/<strong>\s*x\s*([^<]+?)\s*<\/strong>/)?.[1];
    const imagen = img ? tienda.base + html(img) : null;
    const ean = imagen?.match(/\/(\d{8,14})[^/]*\.(?:jpe?g|png|webp)/i)?.[1] ?? null;
    const tam = tamanoTarjeta(tamTxt, nombre);
    // Todorapidas publica precios con centavos (8667.95): se redondea al peso, como lo muestra la página
    const p = Math.round(Number(precio));
    // en oferta la tarjeta trae el precio anterior tachado (<del>$9.000</del>) y el porcentaje (-20%)
    const antes = Number(cuerpo.match(/<del>\s*\$\s*([\d.]+)\s*<\/del>/)?.[1]?.replace(/\./g, "") ?? 0);
    const regular = antes > p ? antes : null;
    const pct = cuerpo.match(/class="item-discount">\s*<strong>\s*-?(\d+)/)?.[1];
    filas.push({
      tienda_id: tienda.id,
      id_externo: id,
      nombre,
      marca: marca && marca !== "Sin marca" ? marca : null,
      codigo_barras: ean,
      categoria_id: categorizar(nombre, slug),
      categoria_tienda: slug,
      categoria_tienda_ref: slug,
      cantidad: tam?.cantidad ?? null,
      unidad: tam?.unidad ?? null,
      precio: p,
      precio_regular: regular,
      promo: regular ? `${pct ?? Math.round((1 - p / regular) * 100)}% dcto` : desc === "true" ? "Descuento" : null,
      precio_comparable: precioComparable(p, tam),
      disponible: disp === "In stock",
      imagen_url: imagen,
      url: slugProd ? `${tienda.base}/es/productos/${slugProd}` : null,
    });
  }
  return filas;
}

/** Descarga todas las páginas de una categoría. */
async function categoria(tienda: TiendaParze, slug: string): Promise<ProductoFila[]> {
  const vistos = new Map<string, ProductoFila>();
  for (let page = 1; page < 100; page++) {
    const r = await fetchConReintentos(`${tienda.base}/es/categoria/${slug}?page=${page}&per_page=30`);
    const nuevos = parsearPagina(await r.text(), slug, tienda).filter((f) => !vistos.has(f.id_externo));
    if (!nuevos.length) break;
    nuevos.forEach((f) => vistos.set(f.id_externo, f));
    await espera(PAUSA_MS);
  }
  return [...vistos.values()];
}

export async function refrescarParze(tienda: TiendaParze, slugs: string[]): Promise<number> {
  let total = 0;
  for (const slug of slugs) {
    try {
      // Un producto aparece en varias categorías (padre e hija): se actualizan precio y datos.
      const n = await guardarProductos(await categoria(tienda, slug));
      await marcarRefresco(tienda.id, slug, n);
      total += n;
    } catch (e) {
      await marcarRefresco(tienda.id, slug, 0, String(e));
    }
  }
  return total;
}

/** Lista de categorías publicada en la tienda; registra las nuevas en `refrescos`. */
export async function sincronizarCategoriasParze(tienda: TiendaParze): Promise<string[]> {
  const slugs = new Set<string>();
  for (const ruta of ["/es/tienda", "/"]) {
    const r = await fetchConReintentos(`${tienda.base}${ruta}`).catch(() => null);
    if (!r) continue;
    for (const m of (await r.text()).matchAll(/href="\/es\/categoria\/([^"?#]+)"/g)) slugs.add(m[1]);
    if (slugs.size) break;
  }
  const filas = [...slugs].map((ref) => ({ tienda_id: tienda.id, ref }));
  if (filas.length) await db().from("refrescos").upsert(filas, { onConflict: "tienda_id,ref", ignoreDuplicates: true });
  return [...slugs];
}

/** Las N categorías que hace más tiempo no se refrescan (rotación continua). */
export async function categoriasMasViejasParze(tienda: TiendaParze, n: number): Promise<string[]> {
  const { data, error } = await db()
    .from("refrescos")
    .select("ref")
    .eq("tienda_id", tienda.id)
    .order("ultimo", { ascending: true, nullsFirst: true })
    .limit(n);
  if (error) throw error;
  return (data ?? []).map((r) => r.ref);
}
