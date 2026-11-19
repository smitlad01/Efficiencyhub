# EfficiencyHub Binary Signer
$cert = Get-ChildItem Cert:\CurrentUser\My -CodeSigningCert | Where-Object { $_.Subject -like "*EfficiencyHub*" } | Select-Object -First 1
if (-not $cert) {
    Write-Host "[*] Generating Authenticode Code Signing Certificate for EfficiencyHub..." -ForegroundColor Cyan
    $cert = New-SelfSignedCertificate -Type CodeSigningCert -Subject "CN=EfficiencyHub, O=EfficiencyHub Open Source" -CertStoreLocation "Cert:\CurrentUser\My" -FriendlyName "EfficiencyHub Code Signing"
}

$setupExe = Join-Path $PSScriptRoot "installer\Output\EfficiencyHub_Setup_v2.4.0.exe"
if (Test-Path $setupExe) {
    $res = Set-AuthenticodeSignature -FilePath $setupExe -Certificate $cert
    Unblock-File -Path $setupExe -ErrorAction SilentlyContinue
    Write-Host "[✓] Signed and unblocked installer: $setupExe (Status: $($res.Status))" -ForegroundColor Green
}

$launcherExe = Join-Path $PSScriptRoot "EfficiencyHub.exe"
if (Test-Path $launcherExe) {
    $res = Set-AuthenticodeSignature -FilePath $launcherExe -Certificate $cert
    Unblock-File -Path $launcherExe -ErrorAction SilentlyContinue
    Write-Host "[✓] Signed and unblocked launcher: $launcherExe (Status: $($res.Status))" -ForegroundColor Green
}

$daemonExe = Join-Path $PSScriptRoot "AutoEfficiencyWatcher.exe"
if (Test-Path $daemonExe) {
    $res = Set-AuthenticodeSignature -FilePath $daemonExe -Certificate $cert
    Unblock-File -Path $daemonExe -ErrorAction SilentlyContinue
    Write-Host "[✓] Signed and unblocked daemon: $daemonExe (Status: $($res.Status))" -ForegroundColor Green
}
