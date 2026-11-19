// Prueba sin base de datos: descarga una categoría real de cada tienda y revisa el parseo.
// Ejecutar: npm test
import { test as Deno_test } from "node:test";
import assert from "node:assert/strict";
const assertEquals: typeof assert.deepEqual = assert.deepEqual;
const Deno = { test: Deno_test };
import { categorizar } from "../src/categorias.js";
import { precioComparable, tamanoDesdeTexto } from "../src/normalizar.js";
import { parsearPagina } from "../src/tiendas/megaredil.js";

Deno.test("tamaños", () => {
  assertEquals(tamanoDesdeTexto("Arroz Diana x 5.000 G."), { cantidad: 5000, unidad: "g" });
  assertEquals(tamanoDesdeTexto("Arroz Integral Diana 1.000 G"), { cantidad: 1000, unidad: "g" });
  assertEquals(tamanoDesdeTexto("Aceite Vegetal Imatá 3.000 Ml"), { cantidad: 3000, unidad: "ml" });
  assertEquals(tamanoDesdeTexto("Harina de Maiz Amarillo Quicksy X 1 Kg"), { cantidad: 1000, unidad: "g" });
  assertEquals(tamanoDesdeTexto("Sixpack de cerveza Poker en lata x 330 ml"), { cantidad: 1980, unidad: "ml" });
  assertEquals(tamanoDesdeTexto("Arepa minitela De Mi Casa 10 un x 500 g"), { cantidad: 500, unidad: "g" });
  assertEquals(tamanoDesdeTexto("Papel higiénico Familia x 4 rollos"), { cantidad: 4, unidad: "un" });
  assertEquals(precioComparable(5550, { cantidad: 2000, unidad: "g" }), 277.5);
  assertEquals(precioComparable(13490, { cantidad: 30, unidad: "un" }), 449.67);
});

Deno.test("categorías", () => {
  assertEquals(categorizar("Arroz Diana 500 G"), "arroz");
  assertEquals(categorizar("Arroz Achocolatado Fiocco 320 Grs"), "cereales");
  assertEquals(categorizar("Aceite de Soya Don Olio 900 Ml"), "aceites");
  assertEquals(categorizar("Aceite Little Angels 180 Ml"), "otros");
  assertEquals(categorizar("Atún en Aceite Carlo Forte 170 G Neto"), "atun");
  assertEquals(categorizar("Huevos Kinder Joy Niño"), "otros");
  assertEquals(categorizar("Huevo El Tesoro Tipo A"), "huevos");
  assertEquals(categorizar("Leche en polvo Colanta x 900 g"), "leche_polvo");
  assertEquals(categorizar("Lenteja el Estío 500 Grs"), "lentejas");
});

Deno.test("megaredil en vivo: categoría de arroz", async () => {
  const html = await (await fetch("https://megaredil.com/es/categoria/arroz-diana-florhuila?page=1&per_page=30")).text();
  const filas = parsearPagina(html, "arroz-diana-florhuila");
  console.log(filas.slice(0, 5).map((f) => `${f.nombre} | $${f.precio} | ${f.cantidad}${f.unidad} | $${f.precio_comparable}/100 | ${f.categoria_id}`));
  assert(filas.length >= 20);
  assert(filas.filter((f) => f.precio_comparable).length / filas.length > 0.8, "la mayoría debe tener precio comparable");
});

Deno.test("megaredil en vivo: aceites (unidad 'Ml')", async () => {
  const html = await (await fetch("https://megaredil.com/es/categoria/aceite-margarina-mantequilla?page=1&per_page=30")).text();
  const aceites = parsearPagina(html, "x").filter((f) => f.categoria_id === "aceites");
  console.log(aceites.slice(0, 5).map((f) => `${f.nombre} | $${f.precio} | ${f.cantidad}${f.unidad} | $${f.precio_comparable}/100`));
  assert(aceites.length > 0 && aceites.every((f) => f.unidad === "ml" || f.cantidad === null));
});

Deno.test("d1 en vivo: API VTEX", async () => {
  const r = await fetch("https://www.d1.com.co/api/catalog_system/pub/products/search?ft=arroz&_from=0&_to=9");
  const datos = await r.json();
  assert(datos.length > 0 && datos[0].items[0].sellers[0].commertialOffer.Price > 0);
  assert(datos[0].categoriesIds[0].startsWith("/"));
});
