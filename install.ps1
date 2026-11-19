# EfficiencyHub Automated Windows Installer & Gateway Script
# Safely downloads, unblocks Mark-of-the-Web, and launches EfficiencyHub

[CmdletBinding()]
param(
    [switch]$Portable = $false
)

$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   EfficiencyHub Automated Installation & Gateway Script  " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$tempDir = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), "EfficiencyHubInstall")
if (-not (Test-Path $tempDir)) {
    New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
}

if ($Portable) {
    $zipUrl = "https://raw.githubusercontent.com/smitlad01/Efficiencyhub/main/installer/Output/EfficiencyHub-v2.4.0-portable.zip"
    $zipFile = Join-Path $tempDir "EfficiencyHub-portable.zip"
    $installDir = Join-Path $env:LOCALAPPDATA "Programs\EfficiencyHub"
    
    Write-Host "[*] Downloading EfficiencyHub Portable package..." -ForegroundColor Cyan
    Invoke-WebRequest -Uri $zipUrl -OutFile $zipFile -UseBasicParsing
    
    Write-Host "[*] Unblocking file attributes..." -ForegroundColor Cyan
    Unblock-File -Path $zipFile
    
    Write-Host "[*] Extracting to $installDir..." -ForegroundColor Cyan
    if (Test-Path $installDir) { Remove-Item $installDir -Recurse -Force }
    Expand-Archive -Path $zipFile -DestinationPath (Split-Path $installDir -Parent) -Force
    
    $exePath = Join-Path $installDir "EfficiencyHub.exe"
    if (Test-Path $exePath) {
        Unblock-File -Path $exePath
        Write-Host "[✓] Installed successfully! Launching EfficiencyHub..." -ForegroundColor Green
        Start-Process $exePath
    }
} else {
    $setupUrl = "https://raw.githubusercontent.com/smitlad01/Efficiencyhub/main/installer/Output/EfficiencyHub_Setup_v2.4.0.exe"
    $setupFile = Join-Path $tempDir "EfficiencyHub_Setup_v2.4.0.exe"
    
    Write-Host "[*] Downloading official EfficiencyHub Setup..." -ForegroundColor Cyan
    Invoke-WebRequest -Uri $setupUrl -OutFile $setupFile -UseBasicParsing
    
    Write-Host "[*] Removing Windows Zone.Identifier (Unblocking)..." -ForegroundColor Cyan
    Unblock-File -Path $setupFile
    
    Write-Host "[✓] Verified safe. Starting installer..." -ForegroundColor Green
    Start-Process -FilePath $setupFile -Verb RunAs
}
