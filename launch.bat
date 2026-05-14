<# : batch portion
@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "& ([scriptblock]::Create([System.IO.File]::ReadAllText('%~f0'))) '%~dp0'"
exit /b %errorlevel%
: end batch #>

param([string]$AppDir = "")
$AppDir = $AppDir.TrimEnd('\').TrimEnd('/')
if (-not $AppDir) { $AppDir = $PSScriptRoot }

$ErrorActionPreference = 'Continue'

$ConfigPath    = Join-Path $AppDir "config.json"
$VersionPath   = Join-Path $AppDir "version.txt"
$VenvPath      = Join-Path $AppDir ".venv"
$Repo          = "so0osh/kaye-budget-mgmt"
$PythonVersion = "3.12.7"
$PythonUrl     = "https://www.python.org/ftp/python/3.12.7/python-3.12.7-amd64.exe"

# ── 1. Read config ────────────────────────────────────────────────────────────
if (-not (Test-Path $ConfigPath)) {
    Write-Host "ERROR: config.json not found in $AppDir" -ForegroundColor Red
    pause; exit 1
}
try {
    $config = Get-Content $ConfigPath -Raw | ConvertFrom-Json
    $pat    = $config.github_pat
    if (-not $pat) { throw "github_pat is empty or missing" }
} catch {
    Write-Host "ERROR: config.json problem: $_" -ForegroundColor Red
    pause; exit 1
}

# ── 2. Python check / silent install ─────────────────────────────────────────
function Test-Python {
    try { $null = & python --version 2>&1; return $true } catch { return $false }
}

if (-not (Test-Python)) {
    Write-Host "Python not found. Installing Python $PythonVersion (this may take a minute)..."
    $installer = Join-Path $env:TEMP "python-$PythonVersion-amd64.exe"
    try {
        Invoke-WebRequest -Uri $PythonUrl -OutFile $installer -UseBasicParsing
        Start-Process -FilePath $installer `
            -ArgumentList "/quiet InstallAllUsers=0 PrependPath=1 Include_launcher=1" `
            -Wait -NoNewWindow
        Remove-Item $installer -Force -ErrorAction SilentlyContinue
    } catch {
        Write-Host "ERROR: Python download/install failed: $_" -ForegroundColor Red
        pause; exit 1
    }
    $u = [Environment]::GetEnvironmentVariable("PATH", "User")
    $m = [Environment]::GetEnvironmentVariable("PATH", "Machine")
    $env:PATH = "$m;$u"
    if (-not (Test-Python)) {
        Write-Host "ERROR: Python still not found after install. Restart and try again." -ForegroundColor Red
        pause; exit 1
    }
    Write-Host "Python $PythonVersion installed." -ForegroundColor Green
}

# ── 3. GitHub release check ───────────────────────────────────────────────────
$headers   = @{ Authorization = "token $pat"; "User-Agent" = "kaye-budget-launcher" }
$latestTag = $null
try {
    $release   = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/releases/latest" -Headers $headers
    $latestTag = $release.tag_name
} catch {
    Write-Host "WARNING: Could not reach GitHub ($($_.Exception.Message)). Skipping update." -ForegroundColor Yellow
}

if ($latestTag) {
    $current = if (Test-Path $VersionPath) { (Get-Content $VersionPath -Raw).Trim() } else { "none" }
    if ($latestTag -ne $current) {
        Write-Host "Update available: $current -> $latestTag. Downloading..."
        $tempZip     = Join-Path $env:TEMP "kaye-update.zip"
        $tempExtract = Join-Path $env:TEMP "kaye-extract-$(Get-Random)"
        try {
            Invoke-WebRequest -Uri "https://api.github.com/repos/$Repo/zipball/$latestTag" `
                -Headers $headers -OutFile $tempZip -UseBasicParsing
            Expand-Archive -Path $tempZip -DestinationPath $tempExtract -Force
            $inner    = (Get-ChildItem $tempExtract -Directory | Select-Object -First 1).FullName
            $preserve = @("config.json", "credentials.json", ".venv")
            foreach ($item in (Get-ChildItem $inner)) {
                if ($preserve -notcontains $item.Name) {
                    $dest = Join-Path $AppDir $item.Name
                    if ($item.PSIsContainer) {
                        Copy-Item $item.FullName $dest -Recurse -Force
                    } else {
                        Copy-Item $item.FullName $dest -Force
                    }
                }
            }
            Set-Content -Path $VersionPath -Value $latestTag -NoNewline
            Write-Host "Updated to $latestTag." -ForegroundColor Green
        } catch {
            Write-Host "WARNING: Update failed: $_. Continuing with current version." -ForegroundColor Yellow
        } finally {
            Remove-Item $tempZip     -Force -ErrorAction SilentlyContinue
            Remove-Item $tempExtract -Recurse -Force -ErrorAction SilentlyContinue
        }
    } else {
        Write-Host "Already on latest ($current)." -ForegroundColor Green
    }
}

# ── 4. Create venv + install deps (first run) ─────────────────────────────────
if (-not (Test-Path $VenvPath)) {
    Write-Host "First run - setting up virtual environment..."
    & python -m venv $VenvPath
    & (Join-Path $VenvPath "Scripts\pip.exe") install -r (Join-Path $AppDir "requirements.txt")
    Write-Host "Dependencies installed." -ForegroundColor Green
}

# ── 5. Launch ─────────────────────────────────────────────────────────────────
Write-Host "Launching app..." -ForegroundColor Cyan
& (Join-Path $VenvPath "Scripts\python.exe") (Join-Path $AppDir "app.py")
