import { test } from "node:test";
import assert from "node:assert/strict";
import { aFilas, buscarFolletoVigente } from "../src/tiendas/ara.js";

test("ara: encuentra el folleto vigente en internet", async () => {
  const url = await buscarFolletoVigente();
  console.log("folleto:", url);
  assert.ok(url && /folleto-ahorro-s\d+\.pdf$/.test(url));
});

test("ara: convierte lo leído por Claude en filas comparables", () => {
  const filas = aFilas(
    {
      vigente_desde: "2026-11-19",
      vigente_hasta: "2026-11-25",
      productos: [
        { nombre: "Arroz Del Costal x 3.000 g", precio_unitario: 9780, precio_regular: 0, promo: "Súper precio", cantidad: 3000, unidad: "g", pagina: 1 },
        { nombre: "Garbanzo Del Costal x 500 g", precio_unitario: 1793, precio_regular: 2690, promo: "3x2", cantidad: 500, unidad: "g", pagina: 2 },
        { nombre: "Cerveza Poker lata sixpack x 330 ml", precio_unitario: 18790, precio_regular: 20890, promo: "Súper precio", cantidad: 1980, unidad: "ml", pagina: 9 },
        { nombre: "Costilla de cerdo", precio_unitario: 9990, precio_regular: 11840, promo: "Precio por libra", cantidad: 500, unidad: "g", pagina: 3 },
        { nombre: "Sin precio", precio_unitario: 0, precio_regular: 0, promo: "30% dcto", cantidad: 0, unidad: "", pagina: 1 },
      ],
    },
    "https://sitemedia.aratiendas.com/wp-content/uploads/2026/11/folleto-ahorro-s47.pdf",
  );
  assert.equal(filas.length, 4);
  const arroz = filas[0];
  assert.equal(arroz.categoria_id, "arroz");
  assert.equal(arroz.precio_comparable, 326);
  assert.equal(arroz.vigente_hasta, "2026-11-25");
  assert.equal(arroz.id_externo, "s47-arroz-del-costal-x-3-000-g");
  assert.equal(filas[1].categoria_id, "arvejas");
  assert.equal(filas[1].precio_regular, 2690);
  assert.equal(filas[2].categoria_id, "cerveza");
  assert.equal(filas[3].categoria_id, "cerdo");
  assert.equal(filas[3].precio_comparable, 1998);
});
