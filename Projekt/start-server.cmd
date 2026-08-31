@echo off
rem Z.Design — Start server on :3000 (production build from C:\zdesign-dist).
rem
rem WHY C:\zdesign-dist: G: is a FAT32 Google-Drive volume — Turbopack needs
rem junctions (unsupported on FAT32) and the sync engine corrupts build writes.
rem The build output therefore lives on NTFS (see build-serve-local.cmd).
rem
rem Usage: start-server.cmd   → starts the server, prints the URL.

set ZDESIGN_DIST_DIR=C:\zdesign-dist\.next
cd /d "%~dp0"

if not exist "%ZDESIGN_DIST_DIR%\BUILD_ID" (
  echo Kein Build gefunden unter %ZDESIGN_DIST_DIR%.
  echo Erst ausfuehren: build-serve-local.cmd
  exit /b 1
)

echo === Stoppe alte Server auf :3000 ===
powershell -NoProfile -Command "Get-NetTCPConnection -State Listen -LocalPort 3000 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"

echo === Starte Server auf :3000 ===
start "ZDesign-Server" /min cmd /c "set ZDESIGN_DIST_DIR=C:\zdesign-dist\.next&& npx next start -p 3000"

echo.
echo Server startet... Oeffne http://localhost:3000
echo MCP-Endpoint: http://127.0.0.1:3000/api/mcp
