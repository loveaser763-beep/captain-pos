# Fix Printing - run as admin
Write-Host "=== Fix Printing for Thermal 80mm ===" -ForegroundColor Green
Restart-Service -Name Spooler -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
try { Set-PrintConfiguration -PrinterName "Fujitsu FP-1000" -PaperSize "80 x 297 mm (48 column)" -ErrorAction Stop; Write-Host "paper set to 80x297 48col" -ForegroundColor Green } catch { Write-Host "paper set fail: $_" -ForegroundColor Red }

Write-Host "Restarting Electron app..." -ForegroundColor Yellow

Get-Process -Name "captain-pos", "Electron" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

$appPath = "D:\شغل\حسابات المحل"

if (Test-Path "$appPath\dist\server.cjs") {
  Start-Process -FilePath "node" -ArgumentList "dist/server.cjs" -WorkingDirectory $appPath -WindowStyle Hidden
  Start-Sleep -Seconds 2
  Start-Process -FilePath "$appPath\node_modules\.bin\electron.cmd" -ArgumentList "." -WorkingDirectory $appPath -WindowStyle Normal
  Write-Host "Electron app launched" -ForegroundColor Green
} else {
  Write-Host "dist not found, run: npm run build" -ForegroundColor Red
}

Write-Host "Done!" -ForegroundColor Cyan
Start-Sleep -Seconds 3
