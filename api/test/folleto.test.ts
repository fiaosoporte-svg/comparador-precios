// Folleto real de Ara (semana 47) contra la revisión manual. Tarda ~45 s por el OCR de 2 páginas.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { extraerFolleto } from "../src/tiendas/ara-pdf.js";

test("ara: extractor sin IA sobre el folleto real", { timeout: 300_000 }, async () => {
  const f = await extraerFolleto(readFileSync(new URL("./folleto-s47.pdf", import.meta.url)));
  assert.equal(f.vigente_desde, "2026-11-19");
  assert.equal(f.vigente_hasta, "2026-11-25");
  const py = readFileSync(new URL("../../scripts_prototipo/ara_s47.py", import.meta.url), "utf8");
  const esperados = [...py.matchAll(/^\s*\((\d+), "([^"]+)", (\d+),/gm)].map((m) => ({ pagina: +m[1], precio: +m[3] }));
  // cada precio esperado debe aparecer en su página
  const pendientes = [...f.productos];
  let ok = 0;
  for (const e of esperados) {
    const i = pendientes.findIndex((p) => p.pagina === e.pagina && p.precio_unitario === e.precio);
    if (i >= 0) { ok++; pendientes.splice(i, 1); }
  }
  console.log(`precios correctos: ${ok}/${esperados.length}, extraídos: ${f.productos.length}`);
  assert.ok(ok / esperados.length >= 0.95, `precisión ${ok}/${esperados.length}`);
  assert.ok(f.productos.length <= esperados.length + 5, "no debe inventar productos");
  // ejemplos puntuales
  const arroz = f.productos.find((p) => /arroz diana x 5\.000/i.test(p.nombre));
  assert.equal(arroz?.precio_unitario, 17990);
  const leche = f.productos.find((p) => /leche deslactosada de la cuesta/i.test(p.nombre));
  assert.equal(leche?.precio_unitario, 3165); // "Lleva 6 por $18.990"
});
