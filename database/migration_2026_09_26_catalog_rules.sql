-- Migración para instalaciones existentes. Ejecutar una sola vez sobre la BD calendario.
-- Agrega cédula de instructor (opcional), evita cédulas repetidas por usuario
-- y evita cursos con el mismo nombre por usuario.

USE calendario;

ALTER TABLE instructores
  ADD COLUMN cedula VARCHAR(40) NULL AFTER nombre;

ALTER TABLE instructores
  ADD UNIQUE KEY uq_instructores_user_cedula (user_id, cedula);

ALTER TABLE cursos
  ADD UNIQUE KEY uq_cursos_user_nombre (user_id, nombre);
