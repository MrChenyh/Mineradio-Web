@echo off
setlocal
set "SHORTCUT=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\Mineradio Bridge.lnk"
if exist "%SHORTCUT%" del "%SHORTCUT%"
echo Mineradio Bridge auto-start has been removed.
pause
