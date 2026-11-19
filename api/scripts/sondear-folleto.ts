// Herramienta de desarrollo: muestra los textos de una página del folleto con su posición.
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { readFileSync } from "node:fs";
const [archivo, pag = "2"] = process.argv.slice(2);
const doc = await getDocument({ data: new Uint8Array(readFileSync(archivo)), verbosity: 0 }).promise;
const page = await doc.getPage(Number(pag));
const vp = page.getViewport({ scale: 1 });
const tc = await page.getTextContent();
console.log("pagina", pag, "de", doc.numPages, "tamaño", vp.width, vp.height, "items", tc.items.length);
for (const it of tc.items as any[]) {
  if (!it.str.trim()) continue;
  const [a, b, c, d, x, y] = it.transform;
  console.log(`${x.toFixed(0).padStart(4)} ${(vp.height - y).toFixed(0).padStart(4)} h${Math.hypot(c, d).toFixed(1).padStart(5)} w${it.width.toFixed(0).padStart(4)} | ${it.str}`);
}
