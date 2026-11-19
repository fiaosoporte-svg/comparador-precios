// Herramienta de desarrollo: muestra lo que lee el OCR en una página.
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { readFileSync, writeFileSync } from "node:fs";
import { cerrarOCR, leerPaginaOCR, renderizarPagina } from "../src/tiendas/ocr.js";
const [archivo, pag = "4"] = process.argv.slice(2);
const doc = await getDocument({ data: new Uint8Array(readFileSync(archivo)), verbosity: 0 }).promise;
writeFileSync(`ocr-p${pag}.png`, await renderizarPagina(doc, Number(pag), 1));
console.time("ocr");
const palabras = await leerPaginaOCR(doc, Number(pag));
console.timeEnd("ocr");
let linea = -1, buf: string[] = [];
for (const p of palabras) {
  if (p.linea !== linea && buf.length) { console.log(buf.join(" ")); buf = []; }
  linea = p.linea;
  buf.push(`${p.s}[${p.x0.toFixed(0)},${p.y0.toFixed(0)} h${(p.y1 - p.y0).toFixed(0)} c${p.confianza.toFixed(0)}]`);
}
console.log(buf.join(" "));
await cerrarOCR();
