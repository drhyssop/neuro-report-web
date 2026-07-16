@echo off
title Neuro Report - Build

cd /d "%~dp0"

echo ============================================
echo   Neuro Report - First-time Build
echo ============================================
echo.
echo This creates the optimized app (needed once,
echo and again after any app update).
echo Takes 1-3 minutes.
echo.

call npm run build

echo.
if errorlevel 1 (
  echo [ERROR] Build failed. See messages above.
) else (
  echo ============================================
  echo   Build complete! Now run start.bat
  echo ============================================
)
echo.
pause
