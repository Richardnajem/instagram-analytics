@echo off
title SWA - Small World Analytics
cd /d "%~dp0"
set "EXE="
for %%f in ("dist\*.exe") do set "EXE=%%~ff"
if defined EXE echo  Launching "%EXE%"
if defined EXE start "" "%EXE%"
if not defined EXE echo  No packaged app found in "dist\" - build it first: npm install, then npm run dist
if not defined EXE echo  Or run the app unpackaged: "START DEV (Live Reload).bat"
if not defined EXE pause
