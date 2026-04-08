$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

function Stop-TelemetryBridgeProcesses {
    $bridgeProcesses = Get-CimInstance Win32_Process |
        Where-Object {
            $_.Name -match '^python(\.exe)?$' -and
            $_.CommandLine -and
            $_.CommandLine -match 'telemetry_bridge\.py'
        }

    foreach ($process in $bridgeProcesses) {
        try {
            Stop-Process -Id $process.ProcessId -Force -ErrorAction Stop
        } catch {
        }
    }
}

Stop-TelemetryBridgeProcesses

Start-Process powershell -ArgumentList @(
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    (Join-Path $root "run_bridge.ps1")
) | Out-Null

Start-Sleep -Seconds 2

powershell -ExecutionPolicy Bypass -File (Join-Path $root "run_frontend.ps1")
