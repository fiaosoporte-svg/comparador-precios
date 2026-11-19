// Compara el extractor contra los 110 productos revisados a mano (scripts_prototipo/ara_s47.py).
// Uso: npx tsx scripts/evaluar-folleto.ts test/folleto-s47.pdf
import { readFileSync } from "node:fs";
import { extraerFolleto } from "../src/tiendas/ara-pdf.js";
import { sinTildes } from "../src/normalizar.js";

const [archivo = "test/folleto-s47.pdf", detalle] = process.argv.slice(2);
const py = readFileSync(new URL("../../scripts_prototipo/ara_s47.py", import.meta.url), "utf8");
const verdad = [...py.matchAll(/^\s*\((\d+), "([^"]+)", (\d+), (None|\d+), "([^"]*)"\),/gm)].map((m) => ({
  pagina: Number(m[1]), nombre: m[2], precio: Number(m[3]), regular: m[4] === "None" ? 0 : Number(m[4]),
}));

const folleto = await extraerFolleto(readFileSync(archivo));
const palabras = (s: string) => new Set(sinTildes(s).split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !["con", "por", "los", "las", "del"].includes(w)));
const parecido = (a: string, b: string) => {
  const A = palabras(a), B = palabras(b);
  return [...A].filter((w) => B.has(w)).length / Math.max(1, Math.min(A.size, B.size));
};

let ok = 0, precioMal = 0, regularMal = 0;
const faltan: string[] = [];
const usados = new Set<number>();
for (const v of verdad) {
  const cands = folleto.productos.map((p, i) => ({ p, i, s: parecido(v.nombre, p.nombre) })).filter((c) => c.p.pagina === v.pagina && !usados.has(c.i) && c.s >= 0.5).sort((a, b) => b.s - a.s);
  const c = cands.find((c) => c.p.precio_unitario === v.precio) ?? cands[0];
  if (!c) { faltan.push(`p${v.pagina} ${v.nombre} $${v.precio}`); continue; }
  usados.add(c.i);
  if (Math.abs(c.p.precio_unitario - v.precio) > 2) { precioMal++; if (detalle) console.log(`PRECIO p${v.pagina} ${v.nombre}: esperado ${v.precio}, sacó ${c.p.precio_unitario} (${c.p.nombre})`); continue; }
  if (v.regular && c.p.precio_regular !== v.regular) { regularMal++; if (detalle) console.log(`REGULAR p${v.pagina} ${v.nombre}: esperado ${v.regular}, sacó ${c.p.precio_regular}`); }
  ok++;
}
const sobran = folleto.productos.filter((_, i) => !usados.has(i));
console.log(`vigencia: ${folleto.vigente_desde} a ${folleto.vigente_hasta}`);
console.log(`extraídos: ${folleto.productos.length} | esperados: ${verdad.length}`);
console.log(`correctos (nombre+precio): ${ok}/${verdad.length} = ${((ok / verdad.length) * 100).toFixed(1)}%  | precio errado: ${precioMal} | precio regular errado: ${regularMal}`);
console.log(`\nNO encontrados (${faltan.length}):\n  ${faltan.join("\n  ")}`);
console.log(`\nSobrantes (${sobran.length}):\n  ${sobran.map((p) => `p${p.pagina} ${p.nombre} $${p.precio_unitario}`).join("\n  ")}`);
