$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

function Add-PathIfMissing {
    param(
        [string]$PathValue
    )

    if (-not $PathValue) {
        return
    }

    $entries = $PathValue -split ";"
    foreach ($entry in $entries) {
        if (-not $entry) {
            continue
        }
        if (-not ($env:Path -split ";" | Where-Object { $_ -eq $entry })) {
            $env:Path = "$env:Path;$entry"
        }
    }
}

function Resolve-PythonLauncher {
    $pythonCommand = Get-Command python -ErrorAction SilentlyContinue
    if ($pythonCommand -and $pythonCommand.Source -notlike "*WindowsApps*") {
        return @{
            Launcher = $pythonCommand.Source
            Prefix = @()
        }
    }

    $pyCommand = Get-Command py -ErrorAction SilentlyContinue
    if ($pyCommand) {
        return @{
            Launcher = $pyCommand.Source
            Prefix = @("-3")
        }
    }

    $candidates = @(
        (Join-Path $env:LOCALAPPDATA "Programs\Python\Python*\python.exe"),
        (Join-Path $env:LOCALAPPDATA "Programs\Python\Launcher\py.exe"),
        "C:\Program Files\Python*\python.exe",
        "C:\Program Files\Python*\py.exe"
    )

    foreach ($pattern in $candidates) {
        $match = Get-ChildItem $pattern -ErrorAction SilentlyContinue |
            Sort-Object FullName -Descending |
            Select-Object -First 1

        if (-not $match) {
            continue
        }

        if ($match.Name -ieq "py.exe") {
            return @{
                Launcher = $match.FullName
                Prefix = @("-3")
            }
        }

        return @{
            Launcher = $match.FullName
            Prefix = @()
        }
    }

    return $null
}

Add-PathIfMissing ([Environment]::GetEnvironmentVariable("Path", "User"))
Add-PathIfMissing ([Environment]::GetEnvironmentVariable("Path", "Machine"))

$resolved = Resolve-PythonLauncher
$launcher = $resolved.Launcher
$prefix = $resolved.Prefix

if (-not $launcher) {
    Write-Host "Python 3.9+ nao encontrado nesta maquina." -ForegroundColor Red
    exit 1
}

$venvPython = Join-Path $root ".venv\Scripts\python.exe"

if (-not (Test-Path $venvPython)) {
    & $launcher @prefix -m venv .venv
}

& $venvPython -m pip install --upgrade pip
& $venvPython -m pip install -r requirements.txt
& $venvPython telemetry_bridge.py
