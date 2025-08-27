# Sistema de Laboratorio - Facultad de Ciencias Médicas UNASAM

Aplicación de escritorio para la gestión del laboratorio de la Facultad de Ciencias Médicas de la Universidad Nacional Santiago Antúnez de Mayolo.

## Características

- Registro de usuarios y sesiones de laboratorio
- Interfaz moderna y amigable
- Almacenamiento local de datos
- Disponible para Windows, macOS y Linux

## Tecnologías utilizadas

- Electron
- React
- TypeScript
- Tailwind CSS
- Vite

## Requisitos

- Node.js 18 o superior
- npm 7 o superior

## Instalación para desarrollo

1. Clonar el repositorio
```bash
git clone https://github.com/fmc-unasam/sistema-laboratorio.git
cd sistema-laboratorio
```

2. Instalar dependencias
```bash
npm install
```

3. Ejecutar en modo desarrollo
```bash
npm run electron:dev
```

## Compilación

Para crear una aplicación ejecutable para su distribución:

```bash
npm run electron:build
```

Los archivos compilados se encontrarán en la carpeta `release`.

## Autor

Facultad de Ciencias Médicas - UNASAM

## Licencia

Copyright © 2025 FMC-UNASAM. Todos los derechos reservados. 