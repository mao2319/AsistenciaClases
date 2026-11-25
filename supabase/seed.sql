-- Datos de prueba FICTICIOS para la demostración.
-- Los rostros NO se siembran: se enrolan en vivo con voluntarios autorizados.

insert into public.grupo (nombre) values
  ('PILOTOS-2026-A'),
  ('TECNICOS-2026-B');

insert into public.docente (documento, nombres, apellidos) values
  ('80000001', 'Laura',  'Restrepo Gil'),
  ('80000002', 'Andrés', 'Molina Vargas'),
  ('80000003', 'Diana',  'Cárdenas Ruiz');

-- Docente inactivo para demostrar que no aparece en el selector
update public.docente set activo = false where documento = '80000003';

insert into public.estudiante (documento, nombres, apellidos, grupo_id)
select v.documento, v.nombres, v.apellidos, g.id
from (values
  ('1000000001', 'Camilo',   'Ortiz Peña',     'PILOTOS-2026-A'),
  ('1000000002', 'Valentina','Rojas León',     'PILOTOS-2026-A'),
  ('1000000003', 'Santiago', 'Herrera Díaz',   'PILOTOS-2026-A'),
  ('1000000004', 'Mariana',  'Quintero Sosa',  'TECNICOS-2026-B'),
  ('1000000005', 'Julián',   'Castaño Mejía',  'TECNICOS-2026-B'),
  ('1000000006', 'Paula',    'Benítez Lozano', 'TECNICOS-2026-B')
) as v(documento, nombres, apellidos, grupo)
join public.grupo g on g.nombre = v.grupo;

-- Sesiones de hoy y mañana (hora de Colombia)
insert into public.sesion (docente_id, grupo_id, asignatura, fecha, hora_inicio, hora_fin)
select d.id, g.id, v.asignatura,
       (now() at time zone 'America/Bogota')::date + v.dia,
       v.inicio::time, v.fin::time
from (values
  ('80000001', 'PILOTOS-2026-A',  'Aerodinámica',        0, '07:00', '09:00'),
  ('80000001', 'TECNICOS-2026-B', 'Meteorología',        0, '10:00', '12:00'),
  ('80000002', 'PILOTOS-2026-A',  'Navegación aérea',    1, '07:00', '09:00'),
  ('80000002', 'TECNICOS-2026-B', 'Sistemas de aeronave',1, '14:00', '16:00')
) as v(doc, grupo, asignatura, dia, inicio, fin)
join public.docente d on d.documento = v.doc
join public.grupo g   on g.nombre = v.grupo;
