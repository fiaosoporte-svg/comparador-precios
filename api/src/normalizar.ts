// Tamaños, unidades y precio comparable, comunes a todas las tiendas.

export type Unidad = "g" | "ml" | "un";
export interface Tamano { cantidad: number; unidad: Unidad }

export function sinTildes(s: string): string {
  return s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** "1.000" -> 1000 ; "201,6" -> 201.6 ; "2.5" -> 2.5 */
function numero(txt: string): number {
  if (/^\d{1,3}(\.\d{3})+$/.test(txt)) return Number(txt.replace(/\./g, ""));
  return Number(txt.replace(",", "."));
}

/** Convierte una cantidad con unidad escrita como venga ("Ml", "Gramos", "Litros", "Rollos"...). */
export function aUnidad(cantidad: number, unidadTexto: string): Tamano | null {
  const u = sinTildes(unidadTexto);
  if (!isFinite(cantidad) || cantidad <= 0) return null;
  if (/^(kg|kilo|kilos|kilogramos?)$/.test(u)) return { cantidad: cantidad * 1000, unidad: "g" };
  if (/^(g|gr|grs|gramos?)$/.test(u)) return { cantidad, unidad: "g" };
  if (/^(l|lt|lts|litros?)$/.test(u)) return { cantidad: cantidad * 1000, unidad: "ml" };
  if (/^(ml|cc|mililitros?)$/.test(u)) return { cantidad, unidad: "ml" };
  if (/^(un|und|unds|unidad|unidades|rollos?|hojas?|pares?|sobres?|tabletas?)$/.test(u)) return { cantidad, unidad: "un" };
  if (/^libras?$/.test(u)) return { cantidad: cantidad * 500, unidad: "g" };
  return null;
}

const RE_TAM = /(\d{1,3}(?:\.\d{3})+|\d+(?:[.,]\d+)?)\s*(kg|kilos?|gramos?|grs?|g|ml|cc|mililitros?|litros?|lts?|l|unidades|unidad|und|un|rollos?)\b/gi;

/**
 * Tamaño a partir de un texto libre ("Arroz Diana x 5.000 g.", "Huevos x 30 un", "6 x 330 ml").
 * Si hay "N x M ml" (sixpack) multiplica. Si hay varios tamaños toma el último.
 */
export function tamanoDesdeTexto(texto: string): Tamano | null {
  const t = texto.replace(/ /g, " ");
  // "6 x 330 ml" = 6 de 330 ml. Ojo: "10 un. x 500 g" = 10 unidades que suman 500 g (no se multiplica).
  const pack = t.match(/\b(\d{1,2})\s*x\s*(\d{1,3}(?:\.\d{3})+|\d+(?:[.,]\d+)?)\s*(ml|g|gr|grs|gramos)\b/i);
  const sixpack = /six\s?pack/i.test(t) ? 6 : 0;
  if (pack || sixpack) {
    const m = pack ?? t.match(/(\d{1,3}(?:\.\d{3})+|\d+(?:[.,]\d+)?)\s*(ml|g|gr|grs|gramos)\b/i);
    const base = m && (pack ? aUnidad(numero(m[2]), m[3]) : aUnidad(numero(m[1]), m[2]));
    const n = pack ? Number(pack[1]) : sixpack;
    if (base && n > 1 && n <= 48) return { cantidad: base.cantidad * n, unidad: base.unidad };
  }
  let ultimo: Tamano | null = null;
  for (const m of t.matchAll(RE_TAM)) {
    const tam = aUnidad(numero(m[1]), m[2]);
    if (tam) ultimo = tam;
  }
  return ultimo;
}

/** Precio por 100 g, por 100 ml o por unidad. */
export function precioComparable(precio: number, tam: Tamano | null): number | null {
  if (!tam || !precio) return null;
  const v = tam.unidad === "un" ? precio / tam.cantidad : (precio / tam.cantidad) * 100;
  return Math.round(v * 100) / 100;
}
