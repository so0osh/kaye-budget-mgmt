<# : batch portion
@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "& ([scriptblock]::Create([System.IO.File]::ReadAllText('%~f0'))) '%~dp0'"
exit /b %errorlevel%
: end batch #>

param([string]$AppDir = "")
$AppDir = $AppDir.TrimEnd('\').TrimEnd('/')
if (-not $AppDir) { $AppDir = $PSScriptRoot }

$PythonVersion = "3.12.7"
$PythonUrl     = "https://www.python.org/ftp/python/3.12.7/python-3.12.7-amd64.exe"

function Test-PythonW {
    try { $null = & pythonw --version 2>&1; return $true } catch { return $false }
}

if (-not (Test-PythonW)) {
    Write-Host "Python not found. Installing Python $PythonVersion (this may take a minute)..."
    $installer = Join-Path $env:TEMP "python-$PythonVersion-amd64.exe"
    try {
        Invoke-WebRequest -Uri $PythonUrl -OutFile $installer -UseBasicParsing
        Start-Process -FilePath $installer `
            -ArgumentList "/quiet InstallAllUsers=0 PrependPath=1 Include_launcher=1" `
            -Wait -NoNewWindow
        Remove-Item $installer -Force -ErrorAction SilentlyContinue
    } catch {
        Write-Host "ERROR: Python install failed: $_" -ForegroundColor Red
        pause; exit 1
    }
    $u = [Environment]::GetEnvironmentVariable("PATH", "User")
    $m = [Environment]::GetEnvironmentVariable("PATH", "Machine")
    $env:PATH = "$m;$u"
    if (-not (Test-PythonW)) {
        Write-Host "ERROR: Python still not found after install. Restart and try again." -ForegroundColor Red
        pause; exit 1
    }
    Write-Host "Python installed." -ForegroundColor Green
}

# Hand off to the Python launcher — it handles everything else (splash, updates, venv, server)
Start-Process -FilePath "pythonw.exe" -ArgumentList (Join-Path $AppDir "launcher.py")
