@echo off
title Neuro Report - Stop
echo Close the server window (the one showing READY) to stop.
echo Or this window can force-stop node:
echo.
choice /c YN /m "Force-stop all Node servers now"
if errorlevel 2 goto :end
taskkill /f /im node.exe >nul 2>&1
echo Done.
:end
pause
