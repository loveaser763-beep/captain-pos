@echo off
title Captain POS Update
color 0A
setlocal EnableDelayedExpansion

set "MSG=%*"
if "%MSG%"=="" set "MSG=chore: release update %date% %time%"

echo ============================================
echo   Captain POS - Update + Deploy
echo   D -^> G -^> GitHub -^> SnapDeploy
echo ============================================
echo.

echo [1/4] Checking code health (tsc)...
cd /d "D:\CaptainPOS"
call "C:\Program Files\nodejs\npm.cmd" run lint >nul 2>&1
if errorlevel 1 (
    echo       - Type errors found! Running report...
    call "C:\Program Files\nodejs\npm.cmd" run lint
    echo       - Fix the errors, then run again.
    pause
    exit /b 1
)
echo       - Done!
echo.

echo [2/4] Syncing code D -^> G: (excluding build artifacts)...
robocopy "D:\CaptainPOS" "G:\نسخه العميل" /E /XO /XD "D:\CaptainPOS\node_modules" "D:\CaptainPOS\release" "D:\CaptainPOS\dist" "D:\CaptainPOS\backups" "D:\CaptainPOS\uploads" "D:\CaptainPOS\.git" "D:\CaptainPOS\New folder" /XF database.sqlite database.sqlite-shm database.sqlite-wal *.log *.backup /NFL /NDL /NJH /NJS
if errorlevel 8 (
    echo       - Robocopy failed!
    pause
    exit /b 1
)
echo       - Done!
echo.

echo [3/4] Building installer (2-3 minutes)...
call "C:\Program Files\nodejs\npm.cmd" run ship:win
if errorlevel 1 (
    echo       - Build error! Press any key to exit
    pause
    exit /b 1
)
echo       - Done!
echo.

echo       Copying installers to G:\تحديث_للعميل ...
if not exist "G:\تحديث_للعميل" mkdir "G:\تحديث_للعميل"
xcopy /Y /D "D:\CaptainPOS\release\CaptainPOS-1.0.0-Portable.exe" "G:\تحديث_للعميل\"
xcopy /Y /D "D:\CaptainPOS\release\CaptainPOS-1.0.0-Windows.exe" "G:\تحديث_للعميل\"
echo       - Done!
echo.

echo [4/4] Committing and pushing to GitHub...
cd /d "D:\CaptainPOS"
git add -A
git diff --cached --quiet
if errorlevel 1 (
    git commit -m "%MSG%"
    git push origin main
    if errorlevel 1 (
        echo       - Push error! Check your internet connection.
    ) else (
        echo       - Pushed. SnapDeploy will auto-deploy.
    )
) else (
    echo       - Nothing to commit.
)
echo.
echo ============================================
echo   Update complete!
echo   - Client copy: G:\نسخه العميل
echo   - Installer:   G:\تحديث_للعميل
echo   - Demo: captain-pos-production.up.railway.app
echo ============================================
echo.
echo Press any key to exit...
pause >nul
