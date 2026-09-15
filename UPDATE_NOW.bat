@echo off
title Captain POS Update
color 0A
echo ============================================
echo   Captain POS - Update + Deploy
echo   D -^> G -^> GitHub -^> SnapDeploy
echo ============================================
echo.
echo [1/4] Syncing code from D to G...
robocopy "D:\CaptainPOS" "G:\نسخه العميل" /E /XO /XD "D:\CaptainPOS\node_modules" "D:\CaptainPOS\release" "D:\CaptainPOS\dist" "D:\CaptainPOS\backups" "D:\CaptainPOS\uploads" "D:\CaptainPOS\.git" "D:\CaptainPOS\New folder" "D:\CaptainPOS\public\zesty-data" "D:\CaptainPOS\public\jameety-data" "D:\CaptainPOS\src\components\jameety\data" /XF database.sqlite database.sqlite-shm database.sqlite-wal *.log /NFL /NDL /NJH /NJS
echo       - Done!
echo.
echo [2/4] Building installer...
echo       - This will take 2-3 minutes...
cd /d "D:\CaptainPOS"
call "C:\Program Files\nodejs\npm.cmd" run ship:win
if %errorlevel% neq 0 (
    echo       - Build error! Press any key to exit
    pause
    exit /b 1
)
echo       - Done!
echo.
echo [3/4] Copying installer to update folder...
if not exist "G:\تحديث_للعميل" mkdir "G:\تحديث_للعميل"
xcopy /Y /D "D:\CaptainPOS\release\CaptainPOS-1.0.0-Portable.exe" "G:\تحديث_للعميل\"
xcopy /Y /D "D:\CaptainPOS\release\CaptainPOS-1.0.0-Windows.exe" "G:\تحديث_للعميل\"
echo       - Done!
echo.
echo [4/4] Pushing to GitHub (auto-deploy to SnapDeploy)...
cd /d "D:\CaptainPOS"
git add -A
git commit -m "Update %date% %time%"
git push origin main
if %errorlevel% neq 0 (
    echo       - Push error! Check your internet connection.
) else (
    echo       - Done! SnapDeploy will auto-deploy.
)
echo.
echo ============================================
echo   Update complete!
echo   - Installer: G:\update_for_client
echo   - Demo: captain-pos-production.up.railway.app
echo ============================================
echo.
echo Press any key to exit...
pause
