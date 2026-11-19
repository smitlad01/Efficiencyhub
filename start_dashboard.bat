@echo off
:: Launcher for EfficiencyHub Dashboard

cd /d "%~dp0"

:: Check if server is already responding
powershell -Command "try { (Invoke-WebRequest -Uri 'http://127.0.0.1:5252/api/rules' -UseBasicParsing -TimeoutSec 1).StatusCode } catch { exit 1 }" >nul 2>&1
if %errorLevel% neq 0 (
    echo Starting EfficiencyHub Server on http://localhost:5252 ...
    start "" /b node server.js
    timeout /t 1 /nobreak >nul
) else (
    echo EfficiencyHub Server is already running.
)

:: Try opening as an app window in Chrome, otherwise default browser
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" --app=http://localhost:5252
) else (
    start http://localhost:5252
)

echo Dashboard is open at http://localhost:5252
