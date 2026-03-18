@echo off
setlocal

cd /d "%~dp0"

if not exist node_modules (
  echo Installing dependencies (first run)...
  call npm.cmd install
  if errorlevel 1 exit /b 1
)

if not exist .env (
  echo Creating .env from .env.example...
  copy /Y ".env.example" ".env" >nul
)

if "%PORT%"=="" set PORT=5000
if "%HOST%"=="" set HOST=127.0.0.1

echo Starting dev server on http://%HOST%:%PORT% ...
call npm.cmd run dev
