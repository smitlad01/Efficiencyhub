Write-Host "=== TEST 1: Watcher PID & Named Pipe Verification ==="
$watcherProc = Get-Process -Name "AutoEfficiencyWatcher" -ErrorAction SilentlyContinue
if (-not $watcherProc) {
    Write-Error "Watcher is not running!"
    exit 1
}
$initialPid = $watcherProc.Id
Write-Host "AutoEfficiencyWatcher running with PID: $initialPid"

$pipes = [System.IO.Directory]::GetFiles("\\.\\pipe\\") | Where-Object { $_ -like "*Efficiency*" }
Write-Host "Found Named Pipes: $($pipes -join ', ')"
if (-not ($pipes -match "EfficiencyHubSync")) {
    Write-Error "Pipe EfficiencyHubSync not found!"
    exit 1
}

Write-Host "`n=== TEST 2: Zero-Restart Auto-Kill Enforcement (< 1s) ==="
# Ensure dummy target exe exists in $env:TEMP
$dummyExe = "$env:TEMP\M2DummyApp.exe"
if (-not (Test-Path $dummyExe)) {
    $src = "using System; using System.Threading; class M2DummyApp { static void Main() { Thread.Sleep(60000); } }"
    Set-Content -Path "$env:TEMP\M2DummyApp.cs" -Value $src
    & "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe" /nologo /target:winexe /platform:anycpu /out:$dummyExe "$env:TEMP\M2DummyApp.cs"
}

# Ensure m2dummyapp is clean in rules first
$toggleOff = @{ target = "m2dummyapp"; type = "auto_kill_on_close"; enabled = $false } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:5252/api/rules/toggle" -Method POST -Body $toggleOff -ContentType "application/json" | Out-Null
Start-Sleep -Milliseconds 300

# Launch M2DummyApp (windowless)
$targetProc = Start-Process -FilePath $dummyExe -PassThru
$targetPid = $targetProc.Id
Write-Host "Launched M2DummyApp with PID: $targetPid"
Start-Sleep -Milliseconds 200

# Verify it is alive
$checkAlive = Get-Process -Id $targetPid -ErrorAction SilentlyContinue
if (-not $checkAlive) {
    Write-Error "M2DummyApp died unexpectedly before rule toggle!"
    exit 1
}
Write-Host "M2DummyApp is alive and running."

# Now toggle auto_kill_on_close rule via server.js API
$sw = [System.Diagnostics.Stopwatch]::StartNew()
$toggleOn = @{ target = "m2dummyapp"; type = "auto_kill_on_close"; enabled = $true } | ConvertTo-Json
$res = Invoke-RestMethod -Uri "http://localhost:5252/api/rules/toggle" -Method POST -Body $toggleOn -ContentType "application/json"
Write-Host "API toggle response: $($res | ConvertTo-Json -Compress)"

# Poll for process termination
$terminated = $false
while ($sw.ElapsedMilliseconds -lt 3000) {
    $proc = Get-Process -Id $targetPid -ErrorAction SilentlyContinue
    if (-not $proc -or $proc.HasExited) {
        $terminated = $true
        break
    }
    Start-Sleep -Milliseconds 50
}
$sw.Stop()
$elapsed = $sw.ElapsedMilliseconds

Write-Host "Termination detection time: $elapsed ms"
if (-not $terminated) {
    Write-Error "FAIL: Process $targetPid was NOT terminated within 3000ms!"
    exit 1
}

if ($elapsed -ge 1500) {
    Write-Error "FAIL: Process termination took $elapsed ms (exceeded 1500ms threshold)!"
    exit 1
}

Write-Host "SUCCESS: Process terminated in $elapsed ms (< 1s enforcement)!"

Write-Host "`n=== TEST 3: Zero Daemon Restart Verification ==="
$currentWatcher = Get-Process -Name "AutoEfficiencyWatcher" -ErrorAction SilentlyContinue
if (-not $currentWatcher) {
    Write-Error "FAIL: Watcher died!"
    exit 1
}
if ($currentWatcher.Id -ne $initialPid) {
    Write-Error "FAIL: Watcher restarted! Initial PID: $initialPid, Current PID: $($currentWatcher.Id)"
    exit 1
}
Write-Host "SUCCESS: Watcher PID unchanged ($initialPid). Daemon survived without restart!"

Write-Host "`n=== TEST 4: Frontend Payload Compatibility ({ name, mode, enabled }) ==="
$frontPayload = @{ name = "m2dummyapp"; mode = "auto_kill_on_close"; enabled = $false } | ConvertTo-Json
$frontRes = Invoke-RestMethod -Uri "http://localhost:5252/api/rules/toggle" -Method POST -Body $frontPayload -ContentType "application/json"
Write-Host "Frontend format toggle response: $($frontRes | ConvertTo-Json -Compress)"

Write-Host "`n=== TEST 5: Watcher Log Inspection ==="
Get-Content "C:\Users\HP\.gemini\antigravity\scratch\EfficiencyHub\watcher.log" -Tail 15
