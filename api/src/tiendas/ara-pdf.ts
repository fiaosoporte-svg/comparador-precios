// Extrae las ofertas del folleto PDF de Ara SIN IA ni OCR: el PDF trae el texto real,
// así que se lee cada texto con su posición y tamaño de letra, y se empareja cada precio
// grande con el nombre de producto más cercano.
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { cerrarOCR, leerPaginaOCR, PalabraOCR } from "./ocr.js";

export interface ProductoFolleto {
  nombre: string;
  precio_unitario: number;
  precio_regular: number;
  promo: string;
  cantidad: number;
  unidad: "g" | "ml" | "un" | "";
  pagina: number;
}
export interface FolletoLeido {
  vigente_desde: string;
  vigente_hasta: string;
  productos: ProductoFolleto[];
}

interface Texto { s: string; x0: number; x1: number; y0: number; y1: number; h: number; cx: number; cy: number; ocr?: boolean; precio?: boolean }
interface Bloque { lineas: Texto[]; x0: number; x1: number; y0: number; y1: number; texto: string }

const RE_PRECIO = /^\$?\s?(\d{1,3}(?:\.\d{3})+)\s*(?:C\/U\.?)?$/i; // "17.990", "$5.390", "14.490C/U."
const precioDe = (s: string) => Number(s.replace(/[^\d]/g, ""));

// Líneas que nunca son nombre de producto
const NO_NOMBRE = [
  /^POR SOLO/i, /^PRECIO/i, /^S[ÚU]PER/i, /^DCTO/i, /^LLEVA/i, /UNIDADES\*/i, /^2 0 \. 0/, /^SON \d/i, /^CAJA\. PRODUCTOS/i,
  /^EN TIENDA/i, /^APLICA/i, /^DEL? \d/i, /^DE (LUNES|MARTES|JUEVES|VIERNES)/i, /^EN LOS PRODUCTOS/i, /^SELECCIONADOS/i,
  /^L[ÍI]NEA SELECTA/i, /^NUEVO/i, /^POR TIEMPO/i, /^LIMITADO/i, /^C\/U/i, /^UN\.?$/i, /^X\d/i, /^\$/, /^NO INCLUYE/i,
  /^A PARTIR DE/i, /^UNIDAD(ES)?$/i, /^\d+\s*DA\.?$/i, /^POR EL$/i, /^PRECIO DE$/i, /^PROH[IÍ]BASE/i, /^CON EL$/i,
  /^DE DESCUENTO/i, /^COMB[IÍ]NALOS/i, /^COMO QUIERAS/i, /^EN ACEITE/i, /^EN LA PLACITA/i, /^CONOCE/i, /^ESC[AÁ]NEAME/i,
  /^LOS IMPERDIBLES/i, /^DE LA SEMANA/i, /^\d+(\s*%)?$/, /^[%X]$/, /^MEGA PACK/i, /^XXL/i, /^\*/,
  /UNIDADES/i, /^\d{2,}/, /^AFIRMACI/i, /^CON ESPECIAS/i, /^Y COLORANTES/i, /^NATURALES$/i, /^VA BIEN/i, /^CON TODO$/i,
];

function esNombre(t: Texto): boolean {
  if (t.h < 3.8 || t.h > 12.5) return false;
  const s = t.s.replace(/^[¡!¿?*\s]+/, "").trim();
  if (s.length < 3 || NO_NOMBRE.some((r) => r.test(s))) return false;
  const tokens = s.split(" ");
  if (tokens.filter((w) => w.length === 1).length / tokens.length > 0.5) return false; // "S o n 2 0 . 0 0 0 ..." (texto espaciado)
  const letras = s.replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ]/g, "");
  if (letras.length < 2) return false;
  const mayus = letras.replace(/[^A-ZÁÉÍÓÚÑ]/g, "").length;
  return mayus / letras.length >= 0.7; // los nombres van en MAYÚSCULAS; los textos de marketing no
}

async function textosPorPagina(pdf: Uint8Array): Promise<Texto[][]> {
  const carga = getDocument({ data: pdf, verbosity: 0 });
  const doc = await carga.promise;
  const paginas: Texto[][] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const alto = page.getViewport({ scale: 1 }).height;
    const vistos = new Set<string>();
    const textos: Texto[] = [];
    for (const it of (await page.getTextContent()).items) {
      if (!("str" in it)) continue;
      const str = it.str.replace(/[\u0000-\u001f\u007f­]/g, "").replace(/\s+/g, " ").trim(); // quita caracteres de control
      if (!str) continue;
      const limpio = str.replace(/^LLEVA (?=\S+ \S+ \S+)/i, ""); // "LLEVA HARINA DE TRIGO" -> "HARINA DE TRIGO"
      const [, , c, d, x, yBase] = it.transform as number[];
      const h = Math.hypot(c, d);
      const y1 = alto - yBase;
      const clave = `${limpio}|${Math.round(x)}|${Math.round(y1)}`;
      if (vistos.has(clave)) continue; // el folleto dibuja cada texto dos veces (efecto negrita)
      vistos.add(clave);
      const x1 = x + Math.max(it.width, h * 0.5);
      textos.push({ s: limpio, x0: x, x1, y0: y1 - h, y1, h, cx: (x + x1) / 2, cy: y1 - h / 2 });
    }
    // Página que es solo imagen (sin texto en el PDF): OCR
    if (textos.length >= 15) {
      paginas.push(textos);
    } else {
      paginas.push(await textosPorOCR(doc, n));
      // El plan gratis de Render tiene 512 MB: después de cada página con OCR se libera todo
      // (la memoria del motor de OCR solo crece mientras viva, y las imágenes de la página son grandes).
      await cerrarOCR();
    }
    page.cleanup();
    liberarMemoria();
  }
  await carga.destroy();
  return paginas;
}

/** Fuerza la recolección de basura si Node se inició con --expose-gc (ver package.json). */
function liberarMemoria() {
  (globalThis as { gc?: () => void }).gc?.();
}

/** Convierte lo leído por OCR al mismo formato de los textos del PDF. */
async function textosPorOCR(doc: Awaited<ReturnType<typeof getDocument>["promise"]>, n: number): Promise<Texto[]> {
  const { palabras, precios } = await leerPaginaOCR(doc, n);
  const caja = (s: string, x0: number, y0: number, x1: number, y1: number, h: number, precio = false): Texto =>
    ({ s, x0, x1, y0, y1, h, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, ocr: true, precio });
  const textos: Texto[] = [];
  // palabras de una misma línea del OCR, seguidas y del mismo alto -> una sola línea de texto
  const porLinea = new Map<number, PalabraOCR[]>();
  for (const p of palabras.filter((p) => p.confianza >= 55)) (porLinea.get(p.linea) ?? porLinea.set(p.linea, []).get(p.linea)!).push(p);
  for (const linea of porLinea.values()) {
    let actual: PalabraOCR[] = [];
    const cerrar = () => {
      if (!actual.length) return;
      const x0 = Math.min(...actual.map((p) => p.x0)), x1 = Math.max(...actual.map((p) => p.x1));
      const y0 = Math.min(...actual.map((p) => p.y0)), y1 = Math.max(...actual.map((p) => p.y1));
      // el alto de la caja de una palabra en mayúsculas es ~0,72 del tamaño de letra
      textos.push(caja(actual.map((p) => p.s).join(" "), x0, y0, x1, y1, (y1 - y0) / 0.72));
      actual = [];
    };
    for (const p of linea.sort((a, b) => a.x0 - b.x0)) {
      const ult = actual[actual.length - 1];
      const altoUlt = ult ? ult.y1 - ult.y0 : 0;
      if (ult && (p.x0 - ult.x1 > altoUlt * 1.5 || Math.abs((p.y1 - p.y0) - altoUlt) > altoUlt * 0.5)) cerrar();
      actual.push(p);
    }
    cerrar();
  }
  for (const p of precios) textos.push(caja(p.s, p.x0, p.y0, p.x1, p.y1, Math.max(14, (p.y1 - p.y0) / 0.72), true));
  return textos;
}

/** Une líneas de nombre consecutivas (mismo tamaño de letra, una debajo de otra, alineadas). */
function bloquesDeNombre(textos: Texto[]): Bloque[] {
  const lineas = textos.filter(esNombre).sort((a, b) => a.y1 - b.y1 || a.x0 - b.x0);
  const bloques: Bloque[] = [];
  for (const l of lineas) {
    const b = bloques.find((b) => {
      const ult = b.lineas[b.lineas.length - 1];
      const dy = l.y1 - ult.y1;
      const mismoTam = Math.abs(l.h - ult.h) / Math.max(l.h, ult.h) < (l.ocr ? 0.5 : 0.25);
      const alineado = Math.abs(l.cx - ult.cx) < Math.max(ult.x1 - ult.x0, l.x1 - l.x0) * 0.6 || Math.abs(l.x0 - ult.x0) < 6;
      return mismoTam && alineado && dy > 0 && dy < ult.h * (l.ocr ? 2.4 : 1.9);
    });
    if (b) {
      b.lineas.push(l);
      b.x0 = Math.min(b.x0, l.x0); b.x1 = Math.max(b.x1, l.x1); b.y1 = l.y1;
    } else {
      bloques.push({ lineas: [l], x0: l.x0, x1: l.x1, y0: l.y0, y1: l.y1, texto: "" });
    }
  }
  for (const b of bloques) b.texto = b.lineas.map((l) => l.s).join(" ").replace(/\s+/g, " ").trim();
  return bloques;
}

/** Distancia entre dos rectángulos (0 si se tocan). */
function distancia(a: { x0: number; x1: number; y0: number; y1: number }, b: { x0: number; x1: number; y0: number; y1: number }) {
  const dx = Math.max(0, a.x0 - b.x1, b.x0 - a.x1);
  const dy = Math.max(0, a.y0 - b.y1, b.y0 - a.y1);
  return Math.hypot(dx, dy * 1.2);
}

const cerca = (textos: Texto[], ref: Texto, radio: number, re: RegExp) =>
  textos.filter((t) => re.test(t.s) && distancia(t, ref) < radio).sort((a, b) => distancia(a, ref) - distancia(b, ref));

function tamanoTexto(s: string): { cantidad: number; unidad: "g" | "ml" | "un" | "" } {
  const m = [...s.matchAll(/(\d{1,3}(?:\.\d{3})+|\d+(?:,\d+)?)\s*(KG|G|GR|ML|L|LT|UN|UND|ROLLOS?)\b\.?/gi)].pop();
  if (!m) return { cantidad: 0, unidad: "" };
  let n = Number(m[1].replace(/\./g, "").replace(",", "."));
  const u = m[2].toUpperCase();
  if (u === "KG") return { cantidad: n * 1000, unidad: "g" };
  if (u === "L" || u === "LT") return { cantidad: n * 1000, unidad: "ml" };
  if (u === "ML") return { cantidad: n, unidad: "ml" };
  if (u.startsWith("UN") || u.startsWith("ROLLO")) return { cantidad: n, unidad: "un" };
  if (/SIXPACK/i.test(s)) n *= 6;
  return { cantidad: n, unidad: "g" };
}

const capitalizar = (s: string) => {
  const t = s.toLowerCase().replace(/\s+x\s+/g, " x ").replace(/\s+\./g, ".").replace(/\.$/, "");
  return t.charAt(0).toUpperCase() + t.slice(1);
};

const MESES: Record<string, string> = { enero: "01", febrero: "02", marzo: "03", abril: "04", mayo: "05", junio: "06", julio: "07", agosto: "08", septiembre: "09", octubre: "10", noviembre: "11", diciembre: "12" };

function vigencia(todo: string): { desde: string; hasta: string } {
  // Hay rangos parciales ("de lunes a miércoles: del 23 al 25..."); se toma el que dice "válidos"
  // o, si no, el más repetido en el folleto.
  const todos = [...todo.matchAll(/(v[áa]lidos )?del (\d{1,2})(?: de (\w+))? al (\d{1,2}) de (\w+) de (\d{4})/gi)];
  if (!todos.length) return { desde: "", hasta: "" };
  const conteo = new Map<string, number>();
  for (const x of todos) conteo.set(x[0].replace(/^v[áa]lidos /i, "").toLowerCase(), (conteo.get(x[0].replace(/^v[áa]lidos /i, "").toLowerCase()) ?? 0) + 1);
  const elegido = todos.find((x) => x[1]) ?? todos.sort((a, b) => (conteo.get(b[0].toLowerCase()) ?? 0) - (conteo.get(a[0].toLowerCase()) ?? 0))[0];
  const m = [elegido[0], elegido[2], elegido[3], elegido[4], elegido[5], elegido[6]];
  const mesFin = MESES[m[4].toLowerCase()] ?? "01";
  const mesIni = m[2] ? MESES[m[2].toLowerCase()] ?? mesFin : mesFin;
  const p = (n: string) => n.padStart(2, "0");
  return { desde: `${m[5]}-${mesIni}-${p(m[1])}`, hasta: `${m[5]}-${mesFin}-${p(m[3])}` };
}

export function extraerDePagina(textos: Texto[], pagina: number): ProductoFolleto[] {
  const esOCR = textos.some((t) => t.ocr);
  const precios = textos.filter((t) => (esOCR ? t.precio : t.h >= 12) && RE_PRECIO.test(t.s));
  const bloques = bloquesDeNombre(textos);
  const usados = new Set<Bloque>();
  const productos: ProductoFolleto[] = [];

  // Emparejar precio <-> nombre: primero los pares más cercanos (asignación voraz global)
  const pares = precios.flatMap((p) => bloques.map((b) => ({ p, b, d: distancia(p, b) }))).filter((x) => x.d < 95).sort((a, b) => a.d - b.d);
  const precioAsignado = new Map<Texto, Bloque>();
  for (const { p, b } of pares) {
    if (precioAsignado.has(p) || usados.has(b)) continue;
    precioAsignado.set(p, b);
    usados.add(b);
  }
  // Un mismo nombre con dos precios (ej. "Arepa x 800 g / 400 g"): reutilizar el bloque más cercano
  for (const p of precios) {
    if (precioAsignado.has(p)) continue;
    const mejor = pares.find((x) => x.p === p);
    if (mejor && cerca(textos, p, 30, /^\d+(?:\.\d{3})?\s*(G|ML)\.?$/i).length) precioAsignado.set(p, mejor.b);
  }
  // Precio sin nombre cerca (recuadros grandes con el nombre lejos): el bloque libre más cercano hasta 330
  for (const p of precios) {
    if (precioAsignado.has(p)) continue;
    const libre = bloques.filter((b) => !usados.has(b) && distancia(p, b) < 330).sort((a, b) => distancia(p, a) - distancia(p, b))[0];
    if (libre) { precioAsignado.set(p, libre); usados.add(libre); }
  }

  for (const [p, b] of precioAsignado) {
    const precio = precioDe(p.s);
    let nombre = b.texto;
    const tam = tamanoTexto(nombre);

    // tamaño escrito junto al precio ("800 G.") manda sobre el del nombre
    const tamJunto = cerca(textos, p, 30, /^\d+(?:\.\d{3})?\s*(G|ML)\.?$/i)[0];
    if (tamJunto) Object.assign(tam, tamanoTexto(tamJunto.s));

    // precio regular: "PRECIO REGULAR:" debajo del precio y el "$x" a su derecha
    let regular = 0;
    const etiqueta = cerca(textos, p, 25, /^PRECIO REGULAR/i)[0];
    if (etiqueta) {
      const valor = textos
        .filter((t) => /\$\s?\d/.test(t.s) && Math.abs(t.cy - etiqueta.cy) < 3 && t.x0 >= etiqueta.x0)
        .sort((a, b) => a.x0 - b.x0)[0];
      if (valor) regular = precioDe(valor.s);
    }

    // promociones: una marca ("LLEVA", "2DA.") solo cuenta si este es el precio más cercano a ella
    const propio = (m: Texto | undefined) => m && precios.every((q) => q === p || distancia(m, p) <= distancia(m, q));
    let unitario = precio;
    let promo = "";
    const lleva = cerca(textos, p, 70, /^lleva$/i).find(propio);
    const numLleva = lleva && textos.find((t) =>
      /^\d{1,2}$/.test(t.s) && t.h > 10 && distancia(t, lleva) < 40 &&
      !textos.some((x) => /^X$/i.test(x.s) && distancia(x, t) < 30)); // "3 X 2" no es "lleva N"
    // "2da unidad": los precios con su propio "PRECIO REGULAR" debajo son de otra oferta
    const segunda = etiqueta ? undefined : cerca(textos, p, 70, /^\d\s*DA\.?$/i).find(propio);
    const porLibra = cerca(textos, p, 25, /^PRECIO POR LIBRA/i)[0];
    if (segunda) {
      const sinDesc = cerca(textos, p, 200, /^\$\d{1,3}(\.\d{3})+ C\/U/i)[0];
      const r = sinDesc ? precioDe(sinDesc.s) : regular;
      if (r) { regular = r; unitario = Math.round((r + precio) / 2); }
      promo = `2da unidad a $${precio.toLocaleString("es-CO")}`;
    } else if (numLleva && Number(numLleva.s) > 1) {
      const n = Number(numLleva.s);
      unitario = Math.round(precio / n);
      promo = `Lleva ${n} por $${precio.toLocaleString("es-CO")}`;
      const sinDesc = cerca(textos, p, 200, /^\$\d{1,3}(\.\d{3})+ (C\/U|UN)/i)[0];
      if (sinDesc && !regular) regular = precioDe(sinDesc.s);
    } else if (porLibra) {
      promo = "Precio por libra";
      if (!tam.cantidad) Object.assign(tam, { cantidad: 500, unidad: "g" });
    } else {
      const pct = cerca(textos, p, 160, /^\d{1,2}$/).find((t) => t.h > 30 && cerca(textos, t, 60, /^%$/).length);
      if (pct) promo = `${pct.s}% dcto`;
      else if (cerca(textos, p, 160, /^S[ÚU]PER/i).length) promo = "Súper precio";
    }

    if (/SIXPACK/i.test(nombre) && tam.unidad === "ml" && tam.cantidad < 1000) tam.cantidad *= 6;
    nombre = capitalizar(nombre);
    productos.push({ nombre, precio_unitario: unitario, precio_regular: regular, promo, cantidad: tam.cantidad, unidad: tam.unidad, pagina });
  }

  // "3x2": nombres sin precio grande pero con "PRECIO REGULAR: $x C/U." cerca y la marca 3X2 en la página
  if (textos.some((t) => /^X$/i.test(t.s)) && textos.some((t) => t.s === "3" && t.h > 20)) {
    for (const b of bloques) {
      if (usados.has(b)) continue;
      const ref = { x0: b.x0, x1: b.x1, y0: b.y0, y1: b.y1 } as Texto;
      const etiqueta = textos.filter((t) => /^PRECIO REGULAR/i.test(t.s) && distancia(t, ref) < 20).sort((a, c) => distancia(a, ref) - distancia(c, ref))[0];
      if (!etiqueta) continue;
      const valor = [etiqueta, ...textos.filter((t) => Math.abs(t.cy - etiqueta.cy) < 9 && t.x0 >= etiqueta.x0 - 5 && distancia(t, etiqueta) < 25)]
        .map((t) => t.s.match(/\$\s?(\d{1,3}(?:\.\d{3})+)/)?.[1]).find(Boolean);
      if (!valor) continue;
      const r = precioDe(valor);
      const tam = tamanoTexto(b.texto);
      productos.push({ nombre: capitalizar(b.texto), precio_unitario: Math.round((r * 2) / 3), precio_regular: r, promo: "3x2", cantidad: tam.cantidad, unidad: tam.unidad, pagina });
    }
  }
  return productos;
}

export async function extraerFolleto(pdf: ArrayBuffer | Uint8Array): Promise<FolletoLeido> {
  // pdfjs no acepta Buffer de Node: siempre una copia como Uint8Array "pura"
  const bytes = pdf instanceof Uint8Array ? new Uint8Array(pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength)) : new Uint8Array(pdf);
  let paginas: Texto[][];
  try {
    paginas = await textosPorPagina(bytes);
  } finally {
    await cerrarOCR(); // libera la memoria del OCR (se usa una vez por semana)
  }
  const todo = paginas.flat().map((t) => t.s).join(" ");
  const { desde, hasta } = vigencia(todo);
  return { vigente_desde: desde, vigente_hasta: hasta, productos: paginas.flatMap((t, i) => extraerDePagina(t, i + 1)) };
}
