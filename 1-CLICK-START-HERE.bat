@echo off
title EfficiencyHub Gateway
echo =======================================================
echo          Starting EfficiencyHub Performance Optimizer
echo =======================================================
cd /d "%~dp0"

if not exist "%~dp0server.js" (
    echo [ERROR] Required files are missing!
    echo It looks like you ran this file from inside a zip archive without extracting.
    echo Please EXTRACT the zip folder first, then run this file.
    pause
    exit /b 1
)

start "" "%~dp0EfficiencyHub.exe"
exit /b 0
