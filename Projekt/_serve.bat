@echo off
cd /d "G:\Andere Computer\Mein Computer\Desktop\Z.Design\Projekt"
set "DATABASE_URL=file:./db/custom.db"
set "NEXTAUTH_SECRET=dev-secret-zdesign-9f3a7c1e5b2d4a8f6e0c3b1a9d7f5e3c"
set "NEXTAUTH_URL=http://localhost:3010"
set "NEXT_TELEMETRY_DISABLED=1"
set "CI=1"
set "FORCE_COLOR=0"
node_modules\.bin\next.cmd dev -p 3010 --webpack
