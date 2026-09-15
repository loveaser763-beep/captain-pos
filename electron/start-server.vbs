Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "D:\شغل\حسابات المحل"
WshShell.Run "node dist/server.cjs", 0, False
