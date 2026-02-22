@echo off
setlocal

cd /d "%~dp0frontend"

set "NPM_CMD="
if exist "C:\Program Files\nodejs\npm.cmd" set "NPM_CMD=C:\Program Files\nodejs\npm.cmd"
if not defined NPM_CMD if exist "C:\Program Files (x86)\nodejs\npm.cmd" set "NPM_CMD=C:\Program Files (x86)\nodejs\npm.cmd"
if not defined NPM_CMD for /f "delims=" %%I in ('where npm.cmd 2^>nul') do (
  set "NPM_CMD=%%I"
  goto :npm_found
)

:npm_found
if not defined NPM_CMD (
  echo [error] npm was not found. Install Node.js LTS and reopen terminal.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [setup] Installing frontend dependencies...
  call "%NPM_CMD%" install
  if errorlevel 1 (
    echo [error] npm install failed.
    pause
    exit /b 1
  )
)

echo [run] Starting React frontend at http://127.0.0.1:5173
call "%NPM_CMD%" run dev -- --host 127.0.0.1 --port 5173
set "EXIT_CODE=%ERRORLEVEL%"

if not "%EXIT_CODE%"=="0" (
  echo [error] Frontend exited with code %EXIT_CODE%.
  pause
)

exit /b %EXIT_CODE%
