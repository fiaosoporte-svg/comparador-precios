-- Comparador de precios Bucaramanga: D1, Megaredil, Ara
-- Lecturas y escrituras: solo la API Node en Render (service role).
-- La app Flutter consume la API, no la base de datos.

create table tiendas (
  id        text primary key,
  nombre    text not null,
  logo_url  text,
  color     text
);

insert into tiendas (id, nombre, logo_url, color) values
  -- logo_url null: la app usa el logo guardado en sus assets
  ('d1',        'D1',        null, '#E30613'),
  ('megaredil', 'Megaredil', null, '#0057A8'),
  ('ara',       'Ara',       'https://aratiendas.com/wp-content/plugins/ara-folleto/assets/logo-ara.svg', '#E4032E');

-- unidad_comparacion: cómo se compara el precio dentro de la categoría
create table categorias (
  id                  text primary key,
  nombre              text not null,
  grupo               text not null,
  orden               int  not null default 100,
  unidad_comparacion  text not null check (unidad_comparacion in ('100g', '100ml', 'unidad'))
);

insert into categorias (id, nombre, grupo, orden, unidad_comparacion) values
  ('arroz',          'Arroz',                     'Despensa', 1,  '100g'),
  ('aceites',        'Aceites',                   'Despensa', 2,  '100ml'),
  ('azucar',         'Azúcar',                    'Despensa', 3,  '100g'),
  ('panela',         'Panela',                    'Despensa', 4,  '100g'),
  ('harinas',        'Harinas',                   'Despensa', 5,  '100g'),
  ('lentejas',       'Lentejas',                  'Despensa', 6,  '100g'),
  ('frijoles',       'Fríjoles',                  'Despensa', 7,  '100g'),
  ('arvejas',        'Arvejas y garbanzos',       'Despensa', 8,  '100g'),
  ('pastas',         'Pastas',                    'Despensa', 9,  '100g'),
  ('cafe',           'Café',                      'Despensa', 10, '100g'),
  ('chocolate',      'Chocolate y cocoa',         'Despensa', 11, '100g'),
  ('sal',            'Sal',                       'Despensa', 12, '100g'),
  ('atun',           'Atún',                      'Despensa', 13, '100g'),
  ('sardinas',       'Sardinas',                  'Despensa', 14, '100g'),
  ('salsas',         'Salsas y condimentos',      'Despensa', 15, '100g'),
  ('cereales',       'Cereales y avena',          'Despensa', 16, '100g'),
  ('leche',          'Leche',                     'Lácteos y huevos', 20, '100ml'),
  ('leche_polvo',    'Leche en polvo',            'Lácteos y huevos', 21, '100g'),
  ('quesos',         'Quesos',                    'Lácteos y huevos', 22, '100g'),
  ('yogur',          'Yogur y kumis',             'Lácteos y huevos', 23, '100ml'),
  ('mantequilla',    'Mantequilla y margarina',   'Lácteos y huevos', 24, '100g'),
  ('huevos',         'Huevos',                    'Lácteos y huevos', 25, 'unidad'),
  ('pollo',          'Pollo',                     'Carnes', 30, '100g'),
  ('res',            'Carne de res',              'Carnes', 31, '100g'),
  ('cerdo',          'Cerdo',                     'Carnes', 32, '100g'),
  ('embutidos',      'Embutidos',                 'Carnes', 33, '100g'),
  ('pan',            'Pan y arepas',              'Panadería', 40, '100g'),
  ('galletas',       'Galletas',                  'Snacks', 50, '100g'),
  ('snacks',         'Snacks y dulces',           'Snacks', 51, '100g'),
  ('gaseosas',       'Gaseosas',                  'Bebidas', 60, '100ml'),
  ('jugos',          'Jugos y bebidas',           'Bebidas', 61, '100ml'),
  ('agua',           'Agua',                      'Bebidas', 62, '100ml'),
  ('cerveza',        'Cerveza y licores',         'Bebidas', 63, '100ml'),
  ('frutas_verduras','Frutas y verduras',         'Frescos', 70, '100g'),
  ('detergente',     'Detergentes',               'Aseo hogar', 80, '100g'),
  ('blanqueador',    'Blanqueadores y cloro',     'Aseo hogar', 81, '100ml'),
  ('lavaloza',       'Lavaloza',                  'Aseo hogar', 82, '100g'),
  ('suavizante',     'Suavizantes',               'Aseo hogar', 83, '100ml'),
  ('limpiadores',    'Limpiadores',               'Aseo hogar', 84, '100ml'),
  ('papel_higienico','Papel higiénico',           'Aseo hogar', 85, 'unidad'),
  ('toallas_cocina', 'Toallas de cocina y servilletas', 'Aseo hogar', 86, 'unidad'),
  ('shampoo',        'Shampoo y acondicionador',  'Aseo personal', 90, '100ml'),
  ('crema_dental',   'Crema dental',              'Aseo personal', 91, '100ml'),
  ('jabon',          'Jabón de baño',             'Aseo personal', 92, '100g'),
  ('desodorante',    'Desodorantes',              'Aseo personal', 93, 'unidad'),
  ('toallas_higienicas','Toallas higiénicas y protectores', 'Aseo personal', 94, 'unidad'),
  ('panales',        'Pañales',                   'Aseo personal', 95, 'unidad'),
  ('mascotas',       'Mascotas',                  'Mascotas', 99, '100g'),
  ('otros',          'Otros',                     'Otros', 1000, 'unidad');

create table productos (
  id                    bigint generated always as identity primary key,
  tienda_id             text not null references tiendas(id),
  id_externo            text not null,
  nombre                text not null,
  marca                 text,
  codigo_barras         text,
  categoria_id          text not null default 'otros' references categorias(id),
  categoria_tienda      text,          -- nombre de la categoría en la tienda
  categoria_tienda_ref  text,          -- id/slug de la categoría en la tienda (para refrescarla)
  cantidad              numeric,       -- tamaño total del empaque
  unidad                text check (unidad in ('g', 'ml', 'un')),
  precio                integer not null,
  precio_regular        integer,       -- precio antes del descuento, si hay
  promo                 text,          -- "3x2", "30% dcto", ...
  precio_comparable     numeric,       -- por 100 g, por 100 ml o por unidad
  disponible            boolean not null default true,
  vigente_hasta         date,          -- ofertas de folleto (Ara)
  imagen_url            text,
  url                   text,
  actualizado_en        timestamptz not null default now(),
  unique (tienda_id, id_externo)
);

create index productos_categoria_idx on productos (categoria_id, precio_comparable);
create index productos_ean_idx       on productos (codigo_barras) where codigo_barras is not null;
create index productos_ref_idx       on productos (tienda_id, categoria_tienda_ref);
create index productos_nombre_idx    on productos using gin (to_tsvector('spanish', nombre));

-- Historial: una fila cada vez que cambia el precio
create table historial_precios (
  id             bigint generated always as identity primary key,
  producto_id    bigint not null references productos(id) on delete cascade,
  precio         integer not null,
  precio_regular integer,
  registrado_en  timestamptz not null default now()
);
create index historial_producto_idx on historial_precios (producto_id, registrado_en desc);

create function registrar_historial() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' or new.precio is distinct from old.precio then
    insert into historial_precios (producto_id, precio, precio_regular)
    values (new.id, new.precio, new.precio_regular);
  end if;
  return new;
end $$;

create trigger productos_historial
  after insert or update on productos
  for each row execute function registrar_historial();

-- Cuándo se refrescó por última vez cada categoría de cada tienda (caché y rotación)
create table refrescos (
  tienda_id  text not null references tiendas(id),
  ref        text not null,           -- id de categoría D1, slug Megaredil, url del folleto Ara
  ultimo     timestamptz,
  productos  int,
  error      text,
  primary key (tienda_id, ref)
);

-- El más barato de cada tienda en cada categoría
create view mejor_por_categoria as
select distinct on (p.categoria_id, p.tienda_id)
  p.categoria_id, c.nombre as categoria, c.unidad_comparacion,
  p.tienda_id, p.id as producto_id, p.nombre, p.precio, p.cantidad, p.unidad,
  p.precio_comparable, p.promo, p.vigente_hasta, p.actualizado_en
from productos p
join categorias c on c.id = p.categoria_id
where p.disponible
  and p.precio_comparable is not null
  and (c.unidad_comparacion = 'unidad' and p.unidad = 'un'
       or c.unidad_comparacion = '100g'  and p.unidad = 'g'
       or c.unidad_comparacion = '100ml' and p.unidad = 'ml')
order by p.categoria_id, p.tienda_id, p.precio_comparable;

-- Seguridad: RLS activo y SIN políticas públicas. Solo la API en Render (service role) lee y escribe.
-- La app Flutter nunca habla con Supabase directamente; siempre pasa por la API.
alter table tiendas           enable row level security;
alter table categorias        enable row level security;
alter table productos         enable row level security;
alter table historial_precios enable row level security;
alter table refrescos         enable row level security;

alter view mejor_por_categoria set (security_invoker = true);
