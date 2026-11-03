@echo off
cd /d "%~dp0"
if not exist dist\index.html (
  echo Build not found. Run npm ci and npm run build.
  pause
  exit /b 1
)
node scripts\serve-demo.mjs
pause
