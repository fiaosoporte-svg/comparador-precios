-- Vigencia de promociones: fecha de inicio (vigente_hasta ya existe).
-- Las versiones de la app NO van aquí: viven en api/public/descargas/versiones.json junto a los APK.
alter table productos add column if not exists vigente_desde date;
create index if not exists productos_vigencia_idx on productos (vigente_hasta) where vigente_hasta is not null;
