@echo off
chcp 65001 >nul
title 회진앱 서버

echo ============================================
echo   회진앱 오프라인 서버
echo ============================================
echo.

cd /d "%~dp0"

echo [1/2] 데이터베이스(Supabase) 시작...
call npx supabase start
if errorlevel 1 (
  echo.
  echo [오류] 데이터베이스 시작 실패.
  echo   - Docker Desktop이 실행 중인지 확인하세요.
  echo.
  pause
  exit /b 1
)

echo.
echo [2/2] 회진앱 서버 시작...
echo.
echo ============================================
echo   준비 완료!
echo.
echo   이 PC:      http://localhost:3000
echo   다른 PC:    http://172.16.62.64:3000
echo.
echo   * 이 창을 닫으면 서버가 꺼집니다.
echo ============================================
echo.

call npm run start -- -H 0.0.0.0 -p 3000

pause
