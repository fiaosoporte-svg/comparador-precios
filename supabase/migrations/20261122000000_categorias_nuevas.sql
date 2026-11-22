-- Categorías para productos que antes quedaban en "Otros" (sobre todo de Megaredil).
insert into categorias (id, nombre, grupo, orden, unidad_comparacion) values
  ('cuidado_bucal',     'Cepillos, enjuague y seda dental',   'Aseo personal', 96,  'unidad'),
  ('afeitada',          'Afeitada',                           'Aseo personal', 97,  'unidad'),
  ('cuidado_capilar',   'Tratamientos y tintes para cabello', 'Aseo personal', 98,  '100ml'),
  ('cuidado_piel',      'Cremas, talcos y cuidado de la piel','Aseo personal', 99,  '100g'),
  ('drogueria',         'Droguería',                          'Droguería',     110, 'unidad'),
  ('hogar_desechables', 'Implementos de aseo y desechables',  'Aseo hogar',    87,  'unidad'),
  ('congelados',        'Congelados y helados',               'Congelados',    35,  '100g')
on conflict (id) do nothing;

update categorias set nombre = 'Café, chocolate y aromáticas' where id = 'cafe';
update categorias set nombre = 'Otros productos' where id = 'otros';
