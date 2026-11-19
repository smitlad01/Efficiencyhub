<#
.SYNOPSIS
    PowerShell Wrapper for EfficiencyHub E2E Test Suite.
.DESCRIPTION
    Executes automated opaque-box requirement verification tests across Tiers 1-4.
.PARAMETER Tier
    Optional tier number (1, 2, 3, or 4).
.PARAMETER Feature
    Optional feature requirement code (r1, r2, r3, r4, r5, r6, or r7).
.PARAMETER Validate
    Runs self-validation testing the test runner, mock servers, and process isolation.
.PARAMETER Json
    Outputs structured summary results in JSON format.
.EXAMPLE
    .\tests\run_all_e2e.ps1 -Validate
.EXAMPLE
    .\tests\run_all_e2e.ps1 -Tier 1
.EXAMPLE
    .\tests\run_all_e2e.ps1 -Feature r4
#>
param(
    [ValidateSet(1, 2, 3, 4)]
    [int]$Tier,

    [ValidateSet("r1", "r2", "r3", "r4", "r5", "r6", "r7")]
    [string]$Feature,

    [switch]$Validate,
    [switch]$Json,
    [switch]$Help
)

if ($Help) {
    Get-Help $MyInvocation.MyCommand.Path -Detailed
    exit 0
}

$runnerScript = Join-Path $PSScriptRoot "run_all_e2e.js"

if (-not (Test-Path $runnerScript)) {
    Write-Error "Test runner script not found at $runnerScript"
    exit 1
}

$nodeArgs = @($runnerScript)

if ($Validate) {
    $nodeArgs += "--validate"
}
if ($Tier) {
    $nodeArgs += "--tier", $Tier
}
if ($Feature) {
    $nodeArgs += "--feature", $Feature
}
if ($Json) {
    $nodeArgs += "--json"
}

& node @nodeArgs
exit $LASTEXITCODE
