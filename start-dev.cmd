@echo off
setlocal
cd /d "%~dp0"

if not exist "node_modules" (
    echo Installation des dependances...
    call npm install
    if errorlevel 1 (
        echo.
        echo L'installation a echoue.
        pause
        exit /b 1
    )
)

echo.
echo Demarrage du serveur ^(port 3001^) et du client ^(port 5173^)...
echo Accessible depuis un telephone sur le meme wifi via l'URL "Network" affichee ci-dessous.
echo Ctrl+C pour arreter.
echo.

call npm run dev

pause
