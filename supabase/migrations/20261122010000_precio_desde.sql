-- Las tiendas (D1, Megaredil) no publican hasta cuándo dura un precio. Lo que sí sabemos es desde cuándo está:
--   precio_desde: cuándo cambió el precio por última vez
--   oferta_desde: cuándo empezó la oferta actual (precio_regular > precio); null si no está en oferta
alter table productos add column if not exists precio_desde timestamptz;
alter table productos add column if not exists oferta_desde timestamptz;

-- valores iniciales a partir del historial
update productos p set precio_desde = h.desde
from (select producto_id, max(registrado_en) as desde from historial_precios group by producto_id) h
where h.producto_id = p.id and p.precio_desde is null;
update productos set precio_desde = actualizado_en where precio_desde is null;
update productos set oferta_desde = precio_desde where precio_regular is not null and oferta_desde is null;

-- se mantienen solas en cada inserción / actualización (incluido el upsert de la API)
create or replace function marcar_cambios_precio() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' or new.precio is distinct from old.precio then
    new.precio_desde := now();
  end if;
  if new.precio_regular is null or new.precio_regular <= new.precio then
    new.oferta_desde := null;
  elsif tg_op = 'INSERT' or old.precio_regular is null or old.precio_regular <= old.precio then
    new.oferta_desde := now();
  end if;
  return new;
end $$;

drop trigger if exists productos_marcar_cambios on productos;
create trigger productos_marcar_cambios
  before insert or update on productos
  for each row execute function marcar_cambios_precio();
