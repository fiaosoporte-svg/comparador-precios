// OCR para las páginas del folleto que vienen solo como imagen (sin texto en el PDF).
// Gratis y local: pdfjs dibuja la página en un canvas y Tesseract lee las palabras con su posición.
import { createCanvas, loadImage, Image, SKRSContext2D } from "@napi-rs/canvas";
import { createWorker, Worker } from "tesseract.js";
import type { PDFDocumentProxy } from "pdfjs-dist/types/src/display/api.js";

export const ESCALA_OCR = 3; // 3x: ~1750 px de ancho por página, suficiente para los nombres pequeños

export interface PalabraOCR { s: string; x0: number; y0: number; x1: number; y1: number; linea: number; confianza: number }

let worker: Promise<Worker> | null = null;
function obtenerWorker() {
  worker ??= createWorker("spa", 1, { cachePath: process.env.TESSERACT_CACHE ?? "/tmp/tesseract" });
  return worker;
}

export async function cerrarOCR() {
  if (worker) await (await worker).terminate();
  worker = null;
}

export async function renderizarPagina(doc: PDFDocumentProxy, n: number, escala = ESCALA_OCR): Promise<Buffer> {
  const page = await doc.getPage(n);
  const viewport = page.getViewport({ scale: escala });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // deno-lint-ignore no-explicit-any
  await page.render({ canvas: canvas as any, canvasContext: ctx as any, viewport }).promise;
  return canvas.toBuffer("image/png");
}

/**
 * Los precios de Ara son números AMARILLOS sobre fondo ROJO, que Tesseract no lee bien.
 * Esta versión de la imagen deja en negro solo el amarillo intenso y todo lo demás en blanco.
 */
export async function soloAmarillo(png: Buffer): Promise<Buffer> {
  const img = await loadImage(png);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const datos = ctx.getImageData(0, 0, img.width, img.height);
  const d = datos.data;
  for (let i = 0; i < d.length; i += 4) {
    const amarillo = d[i] > 215 && d[i + 1] > 175 && d[i + 2] < 90; // el pan y otras fotos tienen más azul
    d[i] = d[i + 1] = d[i + 2] = amarillo ? 0 : 255;
  }
  ctx.putImageData(datos, 0, 0);
  return canvas.toBuffer("image/png");
}

/** Recorta una zona (en píxeles) y la amplía, con margen blanco. */
function recortar(img: Image, x0: number, y0: number, x1: number, y1: number, zoom: number): Buffer {
  const m = 12;
  const w = Math.max(1, x1 - x0), h = Math.max(1, y1 - y0);
  const canvas = createCanvas(Math.round((w + 2 * m) * zoom), Math.round((h + 2 * m) * zoom));
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, x0, y0, w, h, m * zoom, m * zoom, w * zoom, h * zoom);
  return canvas.toBuffer("image/png");
}

async function reconocer(png: Buffer, modo: "texto" | "precios" | "una-linea"): Promise<PalabraOCR[]> {
  const w = await obtenerWorker();
  await w.setParameters(
    modo === "texto"
      ? { tessedit_char_whitelist: "", tessedit_pageseg_mode: "3" as never }
      : { tessedit_char_whitelist: modo === "precios" ? "$0123456789." : "0123456789.", tessedit_pageseg_mode: (modo === "precios" ? "11" : "7") as never },
  );
  const { data } = await w.recognize(png, {}, { blocks: true });
  const palabras: PalabraOCR[] = [];
  let idLinea = 0;
  for (const bloque of data.blocks ?? []) {
    for (const parrafo of bloque.paragraphs) {
      for (const linea of parrafo.lines) {
        idLinea++;
        for (const p of linea.words) {
          const s = p.text.trim();
          if (s) palabras.push({ s, x0: p.bbox.x0, y0: p.bbox.y0, x1: p.bbox.x1, y1: p.bbox.y1, linea: idLinea, confianza: p.confidence });
        }
      }
    }
  }
  return palabras;
}

const RE_PRECIO_OCR = /\d{1,3}\.\d{3}/g;

/**
 * Lee una sola línea de dígitos. El "$" de Ara es pequeño (la mitad de alto que los números)
 * y Tesseract a veces lo lee como "5"; eso se corrige aparte con tieneSignoPesos().
 */
async function leerLineaDigitos(png: Buffer): Promise<string> {
  const w = await obtenerWorker();
  await w.setParameters({ tessedit_char_whitelist: "0123456789.", tessedit_pageseg_mode: "7" as never });
  const { data } = await w.recognize(png, {}, { blocks: true });
  const palabras = (data.blocks ?? []).flatMap((b) => b.paragraphs.flatMap((p) => p.lines.flatMap((l) => l.words)));
  let texto = palabras.map((p) => p.text).join("");
  return texto;
}

/**
 * ¿La zona empieza con un "$" pequeño? Mira la primera figura negra de la izquierda en la máscara
 * y compara su alto con el alto total del precio.
 */
function tieneSignoPesos(ctx: SKRSContext2D, x0: number, y0: number, x1: number, y1: number): boolean {
  const X0 = Math.max(0, Math.floor(x0)), Y0 = Math.max(0, Math.floor(y0));
  const w = Math.max(1, Math.ceil(x1) - X0), h = Math.max(1, Math.ceil(y1) - Y0);
  const d = ctx.getImageData(X0, Y0, w, h).data;
  const negro = (x: number, y: number) => d[(y * w + x) * 4] < 128;
  const columnaTiene = (x: number) => { for (let y = 0; y < h; y++) if (negro(x, y)) return true; return false; };
  let x = 0;
  while (x < w && !columnaTiene(x)) x++;
  const inicio = x;
  while (x < w && columnaTiene(x)) x++;
  if (x >= w || inicio >= w) return false;
  let arriba = h, abajo = 0, altoTotalArriba = h, altoTotalAbajo = 0;
  for (let cx = 0; cx < w; cx++) for (let y = 0; y < h; y++) if (negro(cx, y)) {
    if (cx >= inicio && cx < x) { arriba = Math.min(arriba, y); abajo = Math.max(abajo, y); }
    altoTotalArriba = Math.min(altoTotalArriba, y); altoTotalAbajo = Math.max(altoTotalAbajo, y);
  }
  return abajo - arriba < (altoTotalAbajo - altoTotalArriba) * 0.7;
}

/** Precios de la página (amarillo sobre rojo), en píxeles de la imagen. */
async function preciosDeImagen(mascara: Buffer): Promise<PalabraOCR[]> {
  const img = await loadImage(mascara);
  const W = img.width, H = img.height;
  const lienzo = createCanvas(W, H);
  const ctx = lienzo.getContext("2d");
  ctx.drawImage(img, 0, 0);
  // 1. candidatos: página completa + 4 cuadrantes solapados (Tesseract a veces se salta zonas)
  const zonas = [[0, 0, W, H], [0, 0, W * 0.6, H * 0.6], [W * 0.4, 0, W, H * 0.6], [0, H * 0.4, W * 0.6, H], [W * 0.4, H * 0.4, W, H]];
  const candidatos: PalabraOCR[] = [];
  for (const [x0, y0, x1, y1] of zonas) {
    const recorte = recortar(img, x0, y0, x1, y1, 1);
    for (const p of await reconocer(recorte, "precios")) {
      if (!/\d\.\d/.test(p.s)) continue;
      const m = 12; // margen de recortar()
      candidatos.push({ ...p, x0: p.x0 - m + x0, x1: p.x1 - m + x0, y0: p.y0 - m + y0, y1: p.y1 - m + y0 });
    }
  }
  // 2. quitar repetidos (misma zona leída en varias pasadas)
  const unicos: PalabraOCR[] = [];
  for (const c of candidatos.sort((a, b) => b.confianza - a.confianza)) {
    const solapa = unicos.some((u) => Math.min(u.x1, c.x1) - Math.max(u.x0, c.x0) > 0 && Math.min(u.y1, c.y1) - Math.max(u.y0, c.y0) > 0);
    if (!solapa) unicos.push(c);
  }
  // 3. releer cada candidato recortado y ampliado como una sola línea (mucho más preciso)
  const precios: PalabraOCR[] = [];
  for (const c of unicos) {
    const alto = c.y1 - c.y0;
    const zoom = Math.min(4, Math.max(1.5, 90 / alto));
    const lectura = await leerLineaDigitos(recortar(img, c.x0 - alto * 0.1, c.y0 - alto * 0.15, c.x1 + alto * 0.2, c.y1 + alto * 0.15, zoom));
    const valores = lectura.match(RE_PRECIO_OCR) ?? c.s.match(RE_PRECIO_OCR) ?? [];
    // varios precios pegados ("3.6504.700"): repartir el ancho entre ellos
    valores.forEach((v, i) => {
      const ancho = (c.x1 - c.x0) / valores.length;
      const caja = { x0: c.x0 + ancho * i, x1: c.x0 + ancho * (i + 1), y0: c.y0, y1: c.y1 };
      // "$4.700" leído como "54.700": si su zona empieza con un "$" pequeño, sobra el primer dígito
      const conSigno = /^\d{2,3}\.\d{3}$/.test(v) && tieneSignoPesos(ctx, caja.x0 - alto * 0.1, caja.y0 - alto * 0.15, caja.x1, caja.y1 + alto * 0.15);
      precios.push({ ...c, ...caja, s: conSigno ? v.slice(1) : v });
    });
  }
  return precios;
}

/** Palabras y precios leídos por OCR, en coordenadas del PDF (puntos, origen arriba a la izquierda). */
export async function leerPaginaOCR(doc: PDFDocumentProxy, n: number): Promise<{ palabras: PalabraOCR[]; precios: PalabraOCR[] }> {
  const png = await renderizarPagina(doc, n);
  const aPdf = (p: PalabraOCR) => ({ ...p, x0: p.x0 / ESCALA_OCR, y0: p.y0 / ESCALA_OCR, x1: p.x1 / ESCALA_OCR, y1: p.y1 / ESCALA_OCR });
  const palabras = (await reconocer(png, "texto")).map(aPdf);
  const precios = (await preciosDeImagen(await soloAmarillo(png))).map(aPdf);
  return { palabras, precios };
}
