// Actualizaciones automáticas dentro del servidor (node-cron).
// En Render el plan gratis duerme el servicio tras 15 min sin tráfico y estas tareas se detienen;
// en ese caso usa los endpoints /admin/actualizar/* desde un Cron Job de Render o un servicio externo.
import cron from "node-cron";
import { db, hoyColombia } from "./db.js";
import { refrescarD1 } from "./tiendas/d1.js";
import { refrescarMegaredil } from "./tiendas/megaredil.js";
import { refrescarTodorapidas } from "./tiendas/todorapidas.js";
import { categoriasMasViejasParze, MEGAREDIL, refrescarParze, sincronizarCategoriasParze, TiendaParze, TODORAPIDAS } from "./tiendas/parze.js";
import { refrescarAra } from "./tiendas/ara.js";

const enCurso = new Set<string>();

/**
 * Leer el folleto de Ara con OCR necesita ~600 MB: el plan gratis de Render (512 MB) se reinicia.
 * Por eso es opcional (ARA_OCR=true, por ejemplo en un PC). Sin OCR la app muestra el folleto PDF tal cual.
 */
export const araConOcr = () => process.env.ARA_OCR === "true";

/** Evita que una tarea arranque si la anterior del mismo tipo no ha terminado. */
async function unaALaVez<T>(nombre: string, fn: () => Promise<T>): Promise<T | { omitido: true }> {
  if (enCurso.has(nombre)) return { omitido: true };
  enCurso.add(nombre);
  const inicio = Date.now();
  try {
    const r = await fn();
    console.log(`[tarea] ${nombre} ok en ${((Date.now() - inicio) / 1000).toFixed(1)} s`, r);
    return r;
  } catch (e) {
    console.error(`[tarea] ${nombre} falló:`, e);
    throw e;
  } finally {
    enCurso.delete(nombre);
  }
}

export const actualizarD1 = () => unaALaVez("d1", async () => ({ productos: await refrescarD1() }));

/**
 * Rotación de una tienda Parze (Megaredil, Todorapidas): las N categorías que hace más tiempo no se
 * actualizan. Una vez al día se vuelve a leer la lista de categorías por si la tienda agregó nuevas.
 */
const rotarParze = (tienda: TiendaParze, lote: number) =>
  unaALaVez(tienda.id, async () => {
    const { data: marca } = await db().from("refrescos").select("ultimo").eq("tienda_id", tienda.id).eq("ref", "*categorias").maybeSingle();
    if (!marca?.ultimo || Date.now() - Date.parse(marca.ultimo) > 86_400_000) {
      const slugs = await sincronizarCategoriasParze(tienda);
      await db().from("refrescos").upsert({ tienda_id: tienda.id, ref: "*categorias", ultimo: new Date().toISOString(), productos: slugs.length });
    }
    const refs = (await categoriasMasViejasParze(tienda, lote + 1)).filter((r) => !r.startsWith("*")).slice(0, lote);
    return { categorias: refs, productos: await refrescarParze(tienda, refs) };
  });

export const actualizarMegaredil = (lote = 8) => rotarParze(MEGAREDIL, lote);
export const actualizarTodorapidas = (lote = 8) => rotarParze(TODORAPIDAS, lote);

/** Lee el folleto de Ara con OCR y guarda sus ofertas (solo con ARA_OCR=true). */
export const actualizarAra = (forzar = false) => unaALaVez("ara", () => refrescarAra(forzar));

/**
 * Usa la fecha de vigencia para decidir cuándo volver a buscar precios:
 *  - Ofertas vencidas: se marcan como no disponibles y se busca el folleto nuevo de inmediato.
 *  - Ofertas que vencen hoy: se busca folleto nuevo en cada revisión (Ara suele publicarlo antes).
 *  - D1/Megaredil con fecha vencida (si algún día la publican): se refresca su categoría.
 */
export const revisarVencimientos = () =>
  unaALaVez("vencimientos", async () => {
    const hoy = hoyColombia();
    const { data: vencidas } = await db().from("productos").select("id, tienda_id, categoria_tienda_ref")
      .eq("disponible", true).lt("vigente_hasta", hoy).limit(1000);
    const { count: vencenHoy } = await db().from("productos").select("id", { count: "exact", head: true })
      .eq("disponible", true).eq("tienda_id", "ara").eq("vigente_hasta", hoy);

    const araVencidas = (vencidas ?? []).filter((p) => p.tienda_id === "ara");
    if (araVencidas.length) {
      await db().from("productos").update({ disponible: false }).in("id", araVencidas.map((p) => p.id));
    }
    let ara: unknown = null;
    if (araConOcr() && (araVencidas.length || (vencenHoy ?? 0) > 0)) ara = await actualizarAra().catch((e) => ({ error: String(e) }));

    const otras = (vencidas ?? []).filter((p) => p.tienda_id !== "ara" && p.categoria_tienda_ref);
    const refsD1 = [...new Set(otras.filter((p) => p.tienda_id === "d1").map((p) => p.categoria_tienda_ref as string))];
    const refsDe = (t: string) => [...new Set(otras.filter((p) => p.tienda_id === t).map((p) => p.categoria_tienda_ref as string))];
    const refsMega = refsDe("megaredil");
    const refsTodo = refsDe("todorapidas");
    if (refsD1.length) await refrescarD1(refsD1);
    if (refsMega.length) await refrescarMegaredil(refsMega.slice(0, 10));
    if (refsTodo.length) await refrescarTodorapidas(refsTodo.slice(0, 10));
    return { ara_vencidas: araVencidas.length, ara_vencen_hoy: vencenHoy ?? 0, ara, d1: refsD1.length, megaredil: refsMega.length, todorapidas: refsTodo.length };
  });

export function iniciarTareas() {
  cron.schedule("*/30 * * * *", () => void actualizarD1().catch(() => {}));          // D1 completo cada 30 min
  cron.schedule("*/5 * * * *", () => void actualizarMegaredil().catch(() => {}));    // Megaredil: 8 categorías cada 5 min
  cron.schedule("2-59/5 * * * *", () => void actualizarTodorapidas().catch(() => {})); // Todorapidas: 8 categorías cada 5 min (desfasado)
  cron.schedule("*/15 * * * *", () => void revisarVencimientos().catch(() => {}));    // vencimientos: cada 15 min
  const base = "D1 cada 30 min, Megaredil y Todorapidas cada 5 min, vencimientos cada 15 min";
  if (!araConOcr()) {
    console.log(`[tareas] programadas: ${base} (Ara: solo folleto PDF)`);
    return;
  }
  cron.schedule("15 * * * *", () => void actualizarAra().catch(() => {}));           // Ara: busca folleto nuevo cada hora
  console.log(`[tareas] programadas: ${base}, Ara cada hora`);
}
