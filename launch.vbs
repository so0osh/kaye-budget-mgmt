' Silent launcher — runs pythonw.exe launcher.py with no visible window.
' Falls back to launch.bat (visible) only if Python is not installed.
Dim fso, sh, appDir, cmd
Set fso    = CreateObject("Scripting.FileSystemObject")
Set sh     = CreateObject("WScript.Shell")
appDir     = fso.GetParentFolderName(WScript.ScriptFullName)

cmd = "pythonw.exe " & Chr(34) & appDir & "\launcher.py" & Chr(34)

On Error Resume Next
sh.Run cmd, 0, True
Dim runErr : runErr = Err.Number
On Error GoTo 0

If runErr <> 0 Then
    ' pythonw.exe not in PATH — Python not installed; fall back to launch.bat which installs it
    sh.Run Chr(34) & appDir & "\launch.bat" & Chr(34), 1, False
End If
