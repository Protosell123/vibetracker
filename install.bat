@echo off
echo.
echo  =============================================
echo   Pluggen — First-time setup
echo  =============================================
echo.

echo [1/2] Installing server packages...
cd /d "%~dp0server"
call npm install
if errorlevel 1 (
  echo ERROR: Server install failed.
  pause
  exit /b 1
)

echo.
echo [2/2] Installing client packages...
cd /d "%~dp0client"
call npm install
if errorlevel 1 (
  echo ERROR: Client install failed.
  pause
  exit /b 1
)

echo.
echo  =============================================
echo   Done! Run dev.bat to start Pluggen.
echo  =============================================
echo.
pause
