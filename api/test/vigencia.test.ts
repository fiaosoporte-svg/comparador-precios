import { test } from "node:test";
import assert from "node:assert/strict";
import { conVigencia } from "../src/precios.js";

test("vigencia de promociones", () => {
  const hoy = "2026-11-22";
  assert.equal(conVigencia({ vigente_desde: "2026-11-19", vigente_hasta: "2026-11-25" }, hoy).estado_vigencia, "vigente");
  assert.equal(conVigencia({ vigente_desde: "2026-11-19", vigente_hasta: "2026-11-25" }, hoy).vence_en_dias, 3);
  assert.equal(conVigencia({ vigente_hasta: "2026-11-22" }, hoy).estado_vigencia, "vence_hoy");
  assert.equal(conVigencia({ vigente_hasta: "2026-11-21" }, hoy).estado_vigencia, "vencida");
  assert.equal(conVigencia({ vigente_desde: "2026-11-23", vigente_hasta: "2026-11-25" }, hoy).estado_vigencia, "proxima");
  const sinFecha = conVigencia({ vigente_hasta: null }, hoy);
  assert.equal(sinFecha.estado_vigencia, "sin_fecha");
  assert.equal(sinFecha.vence_en_dias, null);
});
