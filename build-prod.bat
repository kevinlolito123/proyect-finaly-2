@echo off
echo =====================================
echo Construyendo aplicación para producción
echo =====================================

:: Limpiar instalaciones anteriores
echo Limpiando directorios anteriores...
if exist "dist" rmdir /s /q "dist"
if exist "release" rmdir /s /q "release"

:: Construir aplicación React con Vite
echo Construyendo aplicación React...
call npm run build

:: Verificar que se haya creado el directorio dist
if not exist "dist" (
  echo Error: No se pudo crear el directorio dist
  exit /b 1
)

:: Compilar versión para Windows
echo Construyendo aplicación Electron para Windows...
call npm run electron:build

echo.
echo =====================================
echo Compilación completa
echo La aplicación compilada se encuentra en el directorio 'release'
echo ===================================== 