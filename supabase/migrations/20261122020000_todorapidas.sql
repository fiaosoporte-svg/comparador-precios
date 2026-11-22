-- Todorapidas: domicilios en Bucaramanga, Girón, Piedecuesta, Floridablanca y Lebrija (sede en Floridablanca).
insert into tiendas (id, nombre, logo_url, color) values ('todorapidas', 'Todorapidas', null, '#D60303')
on conflict (id) do nothing;
