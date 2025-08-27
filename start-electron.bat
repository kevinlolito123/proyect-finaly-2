@echo off
echo ======================================
echo Iniciando Sistema de Laboratorio FMC
echo ======================================

echo Iniciando aplicacion...
start /b cmd /c "npm run dev -- --port 5174 >nul 2>&1"

timeout /t 8 /nobreak >nul

echo Iniciando aplicacion de escritorio...
set NODE_ENV=development
npx electron . --no-sandbox --disable-dev-shm-usage >nul 2>&1