@echo off
setlocal enabledelayedexpansion
title Neuro Report (offline)

cd /d "%~dp0"

echo ============================================
echo   Neuro Report - Offline Server
echo ============================================
echo.

REM ---------- 1. detect IP ----------
set "MYIP="
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
    set "cand=%%a"
    set "cand=!cand: =!"
    echo !cand! | findstr /b "172.16." >nul && set "MYIP=!cand!"
)
if "!MYIP!"=="" (
    for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
        set "cand=%%a"
        set "cand=!cand: =!"
        echo !cand! | findstr /b "10." >nul && if "!MYIP!"=="" set "MYIP=!cand!"
        echo !cand! | findstr /b "192.168." >nul && if "!MYIP!"=="" set "MYIP=!cand!"
    )
)
if "!MYIP!"=="" set "MYIP=127.0.0.1"

echo [1/2] Current IP: !MYIP!
echo.

REM ---------- 2. start server ----------
echo [2/2] Starting server ...
echo.
echo ============================================
echo   READY
echo.
echo   [ This PC  ]  http://localhost:3000
echo   [ Other PC ]  http://!MYIP!:3000
echo.
echo   ^(Give the [Other PC] address to rounding PCs^)
echo.
echo   * Closing this window stops the server.
echo   * Data is saved in the data\neuro.db file.
echo ============================================
echo.

echo Opening browser ...
timeout /t 3 /nobreak >nul
start "" http://localhost:3000
echo.

call npm run start -- -H 0.0.0.0 -p 3000

pause
