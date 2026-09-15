@echo off
chcp 65001 >nul
REM ShareTrip — запуск с доступом из домашней сети (телефон, планшет).
REM ВНИМАНИЕ: общий адрес НЕ означает общие данные — см. docs/deploy.md,
REM раздел «Почему общий адрес ещё не значит общие данные».

cd /d "%~dp0.."

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js не найден. Установите его с https://nodejs.org и запустите снова.
  echo.
  pause
  exit /b 1
)

node infra\serve.mjs --host 0.0.0.0

pause
