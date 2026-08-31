@echo off
rem Z.Design — Build (webpack) + start server on :3000.
rem
rem WHY: G: is a FAT32 Google-Drive volume. Turbopack (Next 16 default) needs
rem filesystem junctions -> "Unzulässige Funktion" on FAT32; the Google-Drive
rem sync engine also corrupts Next's many small build writes. This script
rem therefore builds with WEBPACK and writes the output to C:\zdesign-dist
rem (NTFS, not synced) via ZDESIGN_DIST_DIR (next.config.ts supports it,
rem default remains ".next" so deploy workflows are unaffected).
rem
rem Usage: build-serve-local.cmd   (takes ~10-15 min for the build)

set ZDESIGN_DIST_DIR=C:\zdesign-dist\.next
cd /d "%~dp0"

echo === Stoppe alte Server auf :3000 ===
powershell -NoProfile -Command "Get-NetTCPConnection -State Listen -LocalPort 3000 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"

echo === BUILD (webpack, distDir %ZDESIGN_DIST_DIR%) ===
call npx next build --webpack
if errorlevel 1 (
  echo BUILD FEHLGESCHLAGEN — Log oben pruefen.
  exit /b 1
)

echo === Starte Server auf :3000 ===
start "ZDesign-Server" /min cmd /c "set ZDESIGN_DIST_DIR=C:\zdesign-dist\.next&& npx next start -p 3000"

echo.
echo Server startet... Oeffne http://localhost:3000
echo MCP-Endpoint: http://127.0.0.1:3000/api/mcp
