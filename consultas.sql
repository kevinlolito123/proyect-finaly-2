-- Consultas básicas para el sistema de laboratorio FMC

-- 1. Visualizar todos los usuarios
SELECT * FROM usuario ORDER BY id DESC;

-- 2. Visualizar todas las sesiones
SELECT * FROM iniciosesion ORDER BY id DESC;

-- 3. Contar registros
SELECT COUNT(*) AS total_usuarios FROM usuario;
SELECT COUNT(*) AS total_sesiones FROM iniciosesion;

-- 4. Buscar usuario por código
SELECT * FROM usuario WHERE codigo = '4444';

-- 5. Buscar sesiones de un usuario específico
SELECT * FROM iniciosesion WHERE codigo = '4444' ORDER BY id DESC;

-- 6. Sesiones por fecha
SELECT * FROM iniciosesion WHERE fecha = CURRENT_DATE ORDER BY horainicio DESC;

-- 7. Estadísticas: sesiones por equipo
SELECT numeroequipo, COUNT(*) as total_sesiones 
FROM iniciosesion 
GROUP BY numeroequipo 
ORDER BY numeroequipo;

-- 8. Estadísticas: sesiones por perfil de usuario
SELECT u.perfil, COUNT(*) as total_sesiones
FROM iniciosesion s
JOIN usuario u ON s.codigo = u.codigo
GROUP BY u.perfil
ORDER BY total_sesiones DESC;

-- 9. Actividades más frecuentes
SELECT actividad, COUNT(*) as frecuencia
FROM iniciosesion
GROUP BY actividad
ORDER BY frecuencia DESC
LIMIT 10;

-- 10. Último inicio de sesión por usuario
SELECT u.codigo, u.nombre, u.perfil, MAX(s.fecha) as ultima_fecha, MAX(s.horainicio) as ultima_hora
FROM usuario u
LEFT JOIN iniciosesion s ON u.codigo = s.codigo
GROUP BY u.codigo, u.nombre, u.perfil
ORDER BY ultima_fecha DESC, ultima_hora DESC;

-- 11. Verificar estructura de las tablas
SELECT column_name, data_type, character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'usuario'
ORDER BY ordinal_position;

SELECT column_name, data_type, character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'iniciosesion'
ORDER BY ordinal_position;

-- 12. Sesiones del día actual
SELECT s.id, s.codigo, u.nombre, s.actividad, s.tiempoestimado, s.numeroequipo, s.horainicio
FROM iniciosesion s
JOIN usuario u ON s.codigo = u.codigo
WHERE s.fecha = CURRENT_DATE
ORDER BY s.horainicio DESC;

-- 13. Resumen semanal de sesiones
SELECT DATE_TRUNC('week', fecha) AS semana, 
       COUNT(*) as total_sesiones
FROM iniciosesion
GROUP BY semana
ORDER BY semana DESC;

-- 14. Verificar permisos de las tablas
SELECT grantee, table_schema, table_name, privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public'
AND table_name IN ('usuario', 'iniciosesion');

-- 15. Limpiar datos (¡USAR CON PRECAUCIÓN!)
-- DELETE FROM iniciosesion WHERE id > 0;
-- DELETE FROM usuario WHERE id > 0;
-- TRUNCATE TABLE iniciosesion, usuario RESTART IDENTITY;

-- 16. Insertar un usuario de prueba manualmente
-- INSERT INTO usuario (codigo, nombre, perfil, escuela, fecha)
-- VALUES ('111111', 'Usuario de Prueba', 'Estudiante', 'Enfermería', NOW());

-- 17. Insertar una sesión de prueba manualmente
-- INSERT INTO iniciosesion (codigo, actividad, tiempoestimado, numeroequipo, fecha, horainicio)
-- VALUES ('111111', 'Sesión de prueba manual', '30 minutos', 5, CURRENT_DATE, CURRENT_TIME); 