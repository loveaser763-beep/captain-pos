$WshShell = New-Object -ComObject WScript.Shell
$desktop = [Environment]::GetFolderPath('Desktop')
$projectPath = "D:\shghl\7isabat AlMahal"
$icoPath = "$projectPath\public\icon.ico"
$linkPath = "$desktop\Captain POS.lnk"
$Shortcut = $WshShell.CreateShortcut($linkPath)
$Shortcut.TargetPath = "cmd.exe"
$Shortcut.Arguments = "/c cd /d `"$projectPath`" && npx electron ."
$Shortcut.WorkingDirectory = $projectPath
$Shortcut.IconLocation = "$icoPath,0"
$Shortcut.Description = "Captain POS"
$Shortcut.WindowStyle = 7
$Shortcut.Save()
Write-Host "Desktop shortcut created!" -ForegroundColor Green
