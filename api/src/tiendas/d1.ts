// D1 usa VTEX: API pública de catálogo, un solo precio nacional.
import { fetchConReintentos, guardarProductos, marcarRefresco, ProductoFila, espera } from "../db.js";
import { categorizar } from "../categorias.js";
import { precioComparable, tamanoDesdeTexto } from "../normalizar.js";

const BASE = "https://www.d1.com.co/api/catalog_system/pub/products/search";
const PASO = 50; // máximo de VTEX por consulta

// deno-lint-ignore no-explicit-any
function convertir(p: any): ProductoFila | null {
  const it = p.items?.[0];
  const of = it?.sellers?.[0]?.commertialOffer;
  if (!it || !of) return null;
  const tam = tamanoDesdeTexto(p.productName);
  const precio = Math.round(of.Price);
  const ref = String(p.categoriesIds?.[0] ?? "").replace(/^\/|\/$/g, ""); // "1/16"
  return {
    tienda_id: "d1",
    id_externo: String(p.productId),
    nombre: p.productName,
    marca: p.brand ?? null,
    codigo_barras: it.ean || null,
    categoria_id: categorizar(p.productName),
    categoria_tienda: String(p.categories?.[0] ?? "").replace(/^\/|\/$/g, "").split("/").pop() ?? null,
    categoria_tienda_ref: ref || null,
    cantidad: tam?.cantidad ?? null,
    unidad: tam?.unidad ?? null,
    precio,
    precio_regular: of.ListPrice > of.Price ? Math.round(of.ListPrice) : null,
    promo: of.ListPrice > of.Price ? `${Math.round((1 - of.Price / of.ListPrice) * 100)}% dcto` : null,
    precio_comparable: precioComparable(precio, tam),
    disponible: (of.AvailableQuantity ?? 0) > 0,
    imagen_url: it.images?.[0]?.imageUrl ?? null,
    url: p.link ?? null,
  };
}

async function paginar(filtro: string): Promise<ProductoFila[]> {
  const filas: ProductoFila[] = [];
  for (let desde = 0; desde < 2500; desde += PASO) {
    const r = await fetchConReintentos(`${BASE}?${filtro}&_from=${desde}&_to=${desde + PASO - 1}&O=OrderByNameASC`);
    const datos = await r.json();
    for (const p of datos) {
      const f = convertir(p);
      if (f) filas.push(f);
    }
    const total = Number((r.headers.get("resources") ?? "").split("/")[1] ?? 0);
    if (datos.length < PASO || desde + PASO >= total) break;
    await espera(200);
  }
  return filas;
}

/** Refresca categorías de D1 por id ("1/16"). Sin refs, refresca todo el catálogo. */
export async function refrescarD1(refs?: string[]): Promise<number> {
  if (!refs?.length) {
    const filas = await paginar("fq=");
    const n = await guardarProductos(filas);
    await marcarRefresco("d1", "*", n);
    return n;
  }
  let total = 0;
  for (const ref of refs) {
    try {
      const n = await guardarProductos(await paginar(`fq=C:/${ref}/`));
      await marcarRefresco("d1", ref, n);
      total += n;
    } catch (e) {
      await marcarRefresco("d1", ref, 0, String(e));
    }
  }
  return total;
}
