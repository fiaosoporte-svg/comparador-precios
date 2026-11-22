// Precios "en vivo" de una categoría: antes de responder, refresca lo que esté vencido.
import { db, hoyColombia, refsVencidas } from "./db.js";
import { refrescarD1 } from "./tiendas/d1.js";
import { refrescarMegaredil } from "./tiendas/megaredil.js";
import { refrescarTodorapidas } from "./tiendas/todorapidas.js";

// Cuánto tiempo se considera fresco un dato antes de volver a consultarlo en la tienda
export const TTL_SEG: Record<string, number> = { d1: 60, megaredil: 600, todorapidas: 600 };
const EN_VIVO = ["d1", "megaredil", "todorapidas"];
const MAX_REFS_PARZE = 4;       // tope de categorías de Megaredil / Todorapidas a descargar en vivo por petición
const MAX_PRODUCTOS_REF = 150;  // categorías "padre" enormes no se descargan en vivo (sus productos están en las hijas)
const UNIDAD: Record<string, string> = { "100g": "g", "100ml": "ml", unidad: "un" };

const COLUMNAS = "id, tienda_id, nombre, marca, codigo_barras, categoria_id, precio, precio_regular, promo, cantidad, unidad, precio_comparable, disponible, vigente_desde, vigente_hasta, precio_desde, oferta_desde, imagen_url, url, actualizado_en";

type ConVigencia = { vigente_desde?: string | null; vigente_hasta?: string | null; actualizado_en?: string };

/**
 * Agrega a cada producto el estado de su vigencia:
 *  - vence_en_dias: días que faltan (0 = vence hoy), null si la tienda no publica fecha
 *  - estado_vigencia: "proxima" (aún no empieza), "vigente", "vence_hoy", "vencida" o "sin_fecha"
 *  - minutos_desde_actualizacion: qué tan fresco es el precio
 */
export function conVigencia<T extends ConVigencia>(p: T, hoy = hoyColombia()) {
  const dias = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
  let estado = "sin_fecha";
  let vence: number | null = null;
  if (p.vigente_hasta) {
    vence = dias(hoy, p.vigente_hasta);
    estado = p.vigente_desde && p.vigente_desde > hoy ? "proxima" : vence < 0 ? "vencida" : vence === 0 ? "vence_hoy" : "vigente";
  }
  const minutos = p.actualizado_en ? Math.round((Date.now() - Date.parse(p.actualizado_en)) / 60_000) : null;
  return { ...p, vence_en_dias: vence, estado_vigencia: estado, minutos_desde_actualizacion: minutos };
}

export class NoEncontrado extends Error {}

export async function preciosCategoria(categoria: string, opciones: { forzar?: boolean; vivo?: boolean } = {}) {
  const { data: cat } = await db().from("categorias").select("*").eq("id", categoria).maybeSingle();
  if (!cat) throw new NoEncontrado(`categoría desconocida: ${categoria}`);

  const refrescado: Record<string, string[]> = {};
  if (opciones.vivo !== false) {
    // 1. qué categorías de cada tienda contienen productos de esta categoría
    const { data: filas } = await db()
      .from("productos")
      .select("tienda_id, categoria_tienda_ref")
      .eq("categoria_id", categoria)
      .in("tienda_id", EN_VIVO)
      .not("categoria_tienda_ref", "is", null);
    const refs: Record<string, string[]> = Object.fromEntries(EN_VIVO.map((t) => [t, [] as string[]]));
    for (const f of filas ?? []) if (!refs[f.tienda_id].includes(f.categoria_tienda_ref)) refs[f.tienda_id].push(f.categoria_tienda_ref);

    // tiendas Parze: las categorías "padre" enormes no se descargan en vivo; tope de categorías por petición
    for (const t of ["megaredil", "todorapidas"]) {
      if (!refs[t].length) continue;
      const { data: tam } = await db().from("refrescos").select("ref, productos").eq("tienda_id", t).in("ref", refs[t]);
      const grandes = new Set((tam ?? []).filter((x) => (x.productos ?? 0) > MAX_PRODUCTOS_REF).map((x) => x.ref));
      const pequenas = refs[t].filter((r) => !grandes.has(r));
      refs[t] = (pequenas.length ? pequenas : refs[t]).slice(0, MAX_REFS_PARZE);
    }

    // 2. refrescar en vivo lo vencido, las tiendas en paralelo
    const refrescar: Record<string, (refs: string[]) => Promise<number>> = {
      d1: refrescarD1, megaredil: refrescarMegaredil, todorapidas: refrescarTodorapidas,
    };
    await Promise.all(
      EN_VIVO.map(async (t) => {
        const vencidas = opciones.forzar ? refs[t] : await refsVencidas(t, refs[t], TTL_SEG[t]);
        if (!vencidas.length) return;
        refrescado[t] = vencidas;
        await refrescar[t](vencidas);
      }),
    );
  }

  // 3. TODOS los productos disponibles de la categoría. Primero los comparables (con tamaño y en la unidad de la
  //    categoría) del más barato al más caro por 100 g / 100 ml / unidad; después el resto, por precio.
  const hoy = hoyColombia();
  const unidad = UNIDAD[cat.unidad_comparacion];
  const filas: Record<string, unknown>[] = [];
  for (let desde = 0; desde < 3000; desde += 1000) {
    const { data, error } = await db()
      .from("productos")
      .select(COLUMNAS)
      .eq("categoria_id", categoria)
      .eq("disponible", true)
      .or(`vigente_hasta.is.null,vigente_hasta.gte.${hoy}`)
      .order("id")
      .range(desde, desde + 999);
    if (error) throw error;
    filas.push(...(data ?? []));
    if ((data ?? []).length < 1000) break;
  }

  const lista = filas
    .map((p) => {
      const v = conVigencia(p as ConVigencia & { unidad?: string; precio_comparable?: number | null; precio: number; tienda_id: string }, hoy);
      return { ...v, comparable: v.unidad === unidad && v.precio_comparable != null };
    })
    .sort((a, b) =>
      a.comparable !== b.comparable ? (a.comparable ? -1 : 1)
        : a.comparable ? (a.precio_comparable as number) - (b.precio_comparable as number)
        : a.precio - b.precio);
  const mejorPorTienda: Record<string, unknown> = {};
  for (const p of lista) if (p.comparable) mejorPorTienda[p.tienda_id] ??= p;

  return { categoria: cat, refrescado, mejor_por_tienda: mejorPorTienda, productos: lista };
}

export async function buscarProductos(texto: string, tienda?: string, limite = 50) {
  // cada palabra debe aparecer en el nombre, en cualquier orden ("diana arroz" encuentra "Arroz Diana x 5.000 g")
  const palabras = texto.replace(/[%_,()*\\]/g, " ").split(/\s+/).filter((p) => p.length > 0).slice(0, 6);
  let q = db().from("productos").select(COLUMNAS).eq("disponible", true);
  for (const p of palabras) q = q.ilike("nombre", `%${p}%`);
  if (tienda) q = q.eq("tienda_id", tienda);
  const { data, error } = await q.order("precio_comparable", { ascending: true, nullsFirst: false }).limit(Math.min(limite, 200));
  if (error) throw error;
  return (data ?? []).map((p) => conVigencia(p));
}

/** Mismo producto (código de barras) en varias tiendas. */
export async function compararPorCodigo(ean: string) {
  const { data, error } = await db().from("productos").select(COLUMNAS).eq("codigo_barras", ean).order("precio");
  if (error) throw error;
  return (data ?? []).map((p) => conVigencia(p));
}

/** Varios productos por id (la lista de compras de la app los consulta para actualizar precios). */
export async function productosPorIds(ids: number[]) {
  const validos = [...new Set(ids.filter((n) => Number.isInteger(n) && n > 0))].slice(0, 200);
  if (!validos.length) return [];
  const { data, error } = await db().from("productos").select(COLUMNAS).in("id", validos);
  if (error) throw error;
  return (data ?? []).map((p) => conVigencia(p));
}

/**
 * Para un producto: el mismo producto en otras tiendas (código de barras) y las alternativas más baratas
 * de su categoría en cada tienda, comparadas por precio por 100 g / 100 ml / unidad.
 */
export async function similares(productoId: number, porTienda = 3) {
  const { data: base, error } = await db().from("productos").select(COLUMNAS).eq("id", productoId).maybeSingle();
  if (error) throw error;
  if (!base) throw new NoEncontrado(`producto desconocido: ${productoId}`);
  const hoy = hoyColombia();

  let mismo: ReturnType<typeof conVigencia>[] = [];
  if (base.codigo_barras) {
    const { data } = await db().from("productos").select(COLUMNAS)
      .eq("codigo_barras", base.codigo_barras).eq("disponible", true).neq("id", base.id).order("precio");
    mismo = (data ?? []).map((p) => conVigencia(p, hoy));
  }

  let alternativas: ReturnType<typeof conVigencia>[] = [];
  if (base.categoria_id !== "otros" && base.unidad && base.precio_comparable != null) {
    const { data } = await db().from("productos").select(COLUMNAS)
      .eq("categoria_id", base.categoria_id)
      .eq("unidad", base.unidad)
      .eq("disponible", true)
      .neq("id", base.id)
      .not("precio_comparable", "is", null)
      .lt("precio_comparable", base.precio_comparable)
      .or(`vigente_hasta.is.null,vigente_hasta.gte.${hoy}`)
      .order("precio_comparable")
      .limit(200);
    const cuenta: Record<string, number> = {};
    for (const p of data ?? []) {
      cuenta[p.tienda_id] = (cuenta[p.tienda_id] ?? 0) + 1;
      if (cuenta[p.tienda_id] <= porTienda) alternativas.push(conVigencia(p, hoy));
    }
  }
  return { producto: conVigencia(base, hoy), mismo_producto: mismo, mas_baratos: alternativas };
}

/** Promociones activas con fecha de vigencia (las que vencen primero, primero). */
export async function promociones(opciones: { tienda?: string; venceEnDias?: number } = {}) {
  const hoy = hoyColombia();
  let q = db().from("productos").select(COLUMNAS)
    .eq("disponible", true)
    .not("vigente_hasta", "is", null)
    .gte("vigente_hasta", hoy);
  if (opciones.tienda) q = q.eq("tienda_id", opciones.tienda);
  if (opciones.venceEnDias !== undefined) {
    const limite = new Date(Date.parse(hoy) + opciones.venceEnDias * 86_400_000).toISOString().slice(0, 10);
    q = q.lte("vigente_hasta", limite);
  }
  const { data, error } = await q.order("vigente_hasta").order("precio_comparable", { nullsFirst: false }).limit(500);
  if (error) throw error;
  return (data ?? []).map((p) => conVigencia(p, hoy));
}

export async function historial(productoId: number) {
  const { data, error } = await db()
    .from("historial_precios")
    .select("precio, precio_regular, registrado_en")
    .eq("producto_id", productoId)
    .order("registrado_en", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data ?? [];
}
