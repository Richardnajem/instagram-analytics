@echo off
title SWA - Small World Analytics [LIVE DEV MODE]
echo.
echo  ============================================
echo   SWA Small World Analytics - DEV MODE
echo   File changes reload the app INSTANTLY.
echo   No rebuild needed while this window is open.
echo  ============================================
echo.
cd /d "%~dp0"
npx electron .
