$target = Join-Path $env:LOCALAPPDATA 'Packages\AD2F1837.OMENCommandCenter_v10z8vjag6ke6\LocalState\EBWebView\Default'
if (Test-Path $target) {
    Remove-Item (Join-Path $target 'GPUCache') -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item (Join-Path $target 'Session Storage') -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item (Join-Path $target 'Local Storage') -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item (Join-Path $target 'Cache') -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "[OK] Cleaned OMEN WebView2 cache."
}

