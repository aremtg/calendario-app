-- Copia de seguridad · Calendario
-- Generado: 2026-09-26 20:15:48

-- Tabla: users
INSERT INTO users (id, name, email, password_hash, role, created_at) VALUES (2, 'GUILLERMO GUARIN', 'guillermo@acbocol.com', '$2y$10$Ldz8iZ5Xj8FPM7CV1GjU6OtvnjEsX7ihuqqOSA0w783jWeott5tW2', 'admin', '2026-09-23 20:05:50');

-- Tabla: plans
INSERT INTO plans (id, user_id, title, notes, plan_date, plan_time, plan_time_end, is_done, alarm_enabled, alarm_days, lugar_id, instructor_id, curso_id, created_at) VALUES (2, 2, 'incendios forestaes', 'wdqwd', '2026-09-29', '12:18:00', NULL, 1, 1, 30, NULL, 1, NULL, '2026-09-26 12:18:28');
INSERT INTO plans (id, user_id, title, notes, plan_date, plan_time, plan_time_end, is_done, alarm_enabled, alarm_days, lugar_id, instructor_id, curso_id, created_at) VALUES (3, 2, 'Manejo de extintores', NULL, '2027-01-15', '00:00:00', '13:14:00', 0, 1, 30, NULL, NULL, 4, '2026-09-26 12:22:28');
INSERT INTO plans (id, user_id, title, notes, plan_date, plan_time, plan_time_end, is_done, alarm_enabled, alarm_days, lugar_id, instructor_id, curso_id, created_at) VALUES (4, 2, 'de', 'dsd', '2026-09-30', '12:22:00', NULL, 0, 1, 30, NULL, 1, NULL, '2026-09-26 12:22:47');
INSERT INTO plans (id, user_id, title, notes, plan_date, plan_time, plan_time_end, is_done, alarm_enabled, alarm_days, lugar_id, instructor_id, curso_id, created_at) VALUES (5, 2, 'swwvfew', NULL, '2026-09-26', '13:25:00', NULL, 0, 1, 30, NULL, NULL, NULL, '2026-09-26 13:25:03');
INSERT INTO plans (id, user_id, title, notes, plan_date, plan_time, plan_time_end, is_done, alarm_enabled, alarm_days, lugar_id, instructor_id, curso_id, created_at) VALUES (6, 2, 'ya paso', 'ede', '2026-09-11', '19:59:00', NULL, 1, 1, 30, NULL, NULL, NULL, '2026-09-26 19:59:12');
INSERT INTO plans (id, user_id, title, notes, plan_date, plan_time, plan_time_end, is_done, alarm_enabled, alarm_days, lugar_id, instructor_id, curso_id, created_at) VALUES (7, 2, 'APH', NULL, '2026-09-30', '08:00:00', NULL, 0, 1, 30, NULL, 1, 3, '2026-09-26 20:11:01');
