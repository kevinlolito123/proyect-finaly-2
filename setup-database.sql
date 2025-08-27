-- Este script crea tablas y vista
-- Ejecutar conectado a la base laboratorio_fmc

-- Crear la tabla de usuarios
CREATE TABLE IF NOT EXISTS usuario (
  id SERIAL PRIMARY KEY,
  codigo VARCHAR(20) UNIQUE NOT NULL,
  nombre VARCHAR(100) NOT NULL,
  perfil VARCHAR(50) NOT NULL,
  escuela VARCHAR(50) NOT NULL,
  fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crear la tabla de sesiones
CREATE TABLE IF NOT EXISTS iniciosesion (
  id SERIAL PRIMARY KEY,
  codigo VARCHAR(20) NOT NULL,
  actividad TEXT,
  tiempoestimado VARCHAR(50),
  numeroequipo INTEGER,
  fecha DATE DEFAULT CURRENT_DATE,
  horainicio TIME DEFAULT CURRENT_TIME,
  CONSTRAINT fk_usuario FOREIGN KEY (codigo) REFERENCES usuario(codigo)
);

-- Crear una vista para consultar sesiones con información del usuario
CREATE OR REPLACE VIEW vista_sesiones AS
SELECT 
  s.id, 
  s.codigo, 
  u.nombre, 
  u.perfil, 
  u.escuela,
  s.actividad, 
  s.tiempoestimado, 
  s.numeroequipo, 
  s.fecha, 
  s.horainicio
FROM iniciosesion s
JOIN usuario u ON s.codigo = u.codigo;
