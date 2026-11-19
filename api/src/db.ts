import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Unidad } from "./normalizar.js";

export interface ProductoFila {
  tienda_id: string;
  id_externo: string;
  nombre: string;
  marca?: string | null;
  codigo_barras?: string | null;
  categoria_id: string;
  categoria_tienda?: string | null;
  categoria_tienda_ref?: string | null;
  cantidad?: number | null;
  unidad?: Unidad | null;
  precio: number;
  precio_regular?: number | null;
  promo?: string | null;
  precio_comparable?: number | null;
  disponible: boolean;
  vigente_desde?: string | null;
  vigente_hasta?: string | null;
  imagen_url?: string | null;
  url?: string | null;
  actualizado_en?: string;
}

function requerida(nombre: string): string {
  const v = process.env[nombre];
  if (!v) throw new Error(`Falta la variable de entorno ${nombre}`);
  return v;
}

let cliente: SupabaseClient | null = null;

/** Cliente con service role: solo vive en el servidor (Render), nunca en la app. */
export function db(): SupabaseClient {
  cliente ??= createClient(requerida("SUPABASE_URL"), requerida("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false },
  });
  return cliente;
}

export async function guardarProductos(filas: ProductoFila[]): Promise<number> {
  const ahora = new Date().toISOString();
  // sin claves repetidas dentro del mismo lote (Postgres rechaza el upsert si se repiten)
  const unicos = [...new Map(filas.map((f) => [`${f.tienda_id}|${f.id_externo}`, { ...f, actualizado_en: ahora }])).values()];
  for (let i = 0; i < unicos.length; i += 500) {
    const { error } = await db().from("productos").upsert(unicos.slice(i, i + 500), { onConflict: "tienda_id,id_externo" });
    if (error) throw new Error(`guardando productos: ${error.message}`);
  }
  return unicos.length;
}

export async function marcarRefresco(tienda: string, ref: string, productos: number, error: string | null = null) {
  await db().from("refrescos").upsert({ tienda_id: tienda, ref, ultimo: new Date().toISOString(), productos, error });
}

/** Refs cuyo último refresco es más viejo que maxEdadSeg (o que nunca se refrescaron). */
export async function refsVencidas(tienda: string, refs: string[], maxEdadSeg: number): Promise<string[]> {
  if (!refs.length) return [];
  const { data } = await db().from("refrescos").select("ref, ultimo").eq("tienda_id", tienda).in("ref", refs);
  const limite = Date.now() - maxEdadSeg * 1000;
  const frescas = new Set((data ?? []).filter((r) => r.ultimo && Date.parse(r.ultimo) > limite).map((r) => r.ref));
  return refs.filter((r) => !frescas.has(r));
}

export const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function fetchConReintentos(url: string, intentos = 4): Promise<Response> {
  let ultimoError: unknown;
  for (let i = 0; i < intentos; i++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (comparador-precios)" } });
      if (r.ok) return r;
      ultimoError = new Error(`HTTP ${r.status} en ${url}`);
      if (r.status === 404) break;
    } catch (e) {
      ultimoError = e;
    }
    await espera(2000 * 2 ** i);
  }
  throw ultimoError;
}

/** Fecha de hoy en Colombia (AAAA-MM-DD); las vigencias de los folletos son fechas locales. */
export function hoyColombia(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
}
