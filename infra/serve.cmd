@echo off
chcp 65001 >nul
REM ShareTrip — запуск на локальном компьютере. Достаточно двойного клика.
REM Нужен Node.js 20+: https://nodejs.org

cd /d "%~dp0.."

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js не найден. Установите его с https://nodejs.org и запустите снова.
  echo.
  pause
  exit /b 1
)

echo.
echo   Запускаю ShareTrip... Браузер откроется сам.
echo.

start "" http://localhost:8765
node infra\serve.mjs

pause
