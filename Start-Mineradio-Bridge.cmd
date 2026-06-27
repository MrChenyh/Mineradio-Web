@echo off
setlocal
cd /d "%~dp0"

if exist "node\node.exe" (
  set "NODE_EXE=%~dp0node\node.exe"
) else (
  set "NODE_EXE=node"
)

"%NODE_EXE%" "bridge\start-bridge.js"
if errorlevel 1 (
  echo.
  echo Mineradio Bridge failed to start.
  echo If this is a source checkout, run npm install once or use the packaged zip from Releases.
  pause
)
