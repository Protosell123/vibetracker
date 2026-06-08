@echo off
echo.
echo  Starting Pluggen Hub...
echo.

start "Pluggen Server" cmd /k "cd /d "%~dp0server" && node server.js"
timeout /t 2 /nobreak > nul
start "Pluggen UI" cmd /k "cd /d "%~dp0client" && npm run dev"
timeout /t 4 /nobreak > nul
start http://localhost:3000

echo  Server  ^> http://localhost:3001
echo  App     ^> http://localhost:3000
echo.
echo  Two terminal windows have opened. Close them to stop Pluggen.
echo.
