@echo off
setlocal

cd /d "%~dp0"

set "VENV_PY=.venv\Scripts\python.exe"

if not exist "%VENV_PY%" (
  echo [setup] Creating virtual environment...
  py -3 -m venv .venv 2>nul || python -m venv .venv
  if errorlevel 1 (
    echo [error] Could not create virtual environment.
    pause
    exit /b 1
  )
)

echo [setup] Installing/updating requirements...
"%VENV_PY%" -m pip install -r requirements.txt
if errorlevel 1 (
  echo [error] pip install failed.
  pause
  exit /b 1
)

set "HOST=127.0.0.1"
set "PORT=8020"
set "UI_URL=http://%HOST%:%PORT%/ui"

echo [run] Starting backend + UI at %UI_URL%
start "" "%UI_URL%"
"%VENV_PY%" -m uvicorn app.main:app --host %HOST% --port %PORT% --reload
set "EXIT_CODE=%ERRORLEVEL%"

if not "%EXIT_CODE%"=="0" (
  echo [error] Server exited with code %EXIT_CODE%.
  pause
)

exit /b %EXIT_CODE%
