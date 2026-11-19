<#
.SYNOPSIS
    Builds the standalone EfficiencyHub Windows installer executable using Inno Setup.
.PARAMETER OutputDir
    Optional custom output directory for the compiled installer executable.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory=$false)]
    [string]$OutputDir = ""
)

$ErrorActionPreference = "Stop"

$root = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
if (-not $root) { $root = Get-Location }
if (-not $OutputDir) { $OutputDir = Join-Path $root "dist" }

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host " EfficiencyHub Standalone Installer Builder  " -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# 1. Validate required source inputs
$requiredFiles = @(
    (Join-Path $root "EfficiencyHub.exe"),
    (Join-Path $root "app.ico"),
    (Join-Path $root "server.js"),
    (Join-Path $root "AutoEfficiencyWatcher.exe"),
    (Join-Path $root "rules.json"),
    (Join-Path $root "public\index.html"),
    (Join-Path $root "installer\EfficiencyHubSetup.iss")
)

foreach ($filePath in $requiredFiles) {
    if (-not (Test-Path $filePath)) {
        Write-Error "Required input file missing: $filePath"
        throw "Input validation failed: $filePath does not exist."
        exit 1
    }
}
Write-Host "[v] All source assets and Inno Setup configuration verified." -ForegroundColor Green

# 2. Ensure output directory exists
if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

# 3. Locate Inno Setup Compiler (ISCC.exe)
$isccCandidates = @(
    (Get-Command "ISCC.exe" -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source),
    (Get-Command "ISCC" -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source),
    "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe",
    "${env:ProgramFiles}\Inno Setup 6\ISCC.exe",
    "${env:LOCALAPPDATA}\Programs\InnoSetup\ISCC.exe",
    "${env:LOCALAPPDATA}\Programs\Inno Setup 6\ISCC.exe"
)

$isccPath = $null
foreach ($candidate in $isccCandidates) {
    if ($candidate -and (Test-Path $candidate)) {
        $isccPath = $candidate
        break
    }
}

$issFile = Join-Path $root "installer\EfficiencyHubSetup.iss"

if ($isccPath) {
    Write-Host "[*] Compiling installer with ISCC: $isccPath" -ForegroundColor Yellow
    & "$isccPath" "/O$OutputDir" "$issFile"
    if ($LASTEXITCODE -ne 0) {
        throw "ISCC compilation failed with exit code $LASTEXITCODE"
        exit $LASTEXITCODE
    }
    Write-Host "[v] Installer compiled successfully in: $OutputDir" -ForegroundColor Green
} else {
    Write-Host "[i] Inno Setup compiler (ISCC.exe) was not found on PATH or standard program directories." -ForegroundColor Yellow
    Write-Host "    Configuration script validated: $issFile" -ForegroundColor Yellow
    Write-Host "    To generate binary .exe: Install Inno Setup 6 from https://jrsoftware.org/isdl.php" -ForegroundColor Yellow
}
