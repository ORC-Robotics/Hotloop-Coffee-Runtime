param(
    [switch]$Install,
    [switch]$Build
)

$ErrorActionPreference = "Stop"

$workspaceRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$frontendDir = Join-Path $workspaceRoot "frontend"
$nodeModulesDir = Join-Path $frontendDir "node_modules"
$npmPackageLock = Join-Path $frontendDir "package-lock.json"
$electronBuilderCmd = Join-Path $frontendDir "node_modules\.bin\electron-builder.cmd"
$localAppData = [Environment]::GetFolderPath("LocalApplicationData")

function Resolve-NodeInstallation {
    $candidateNodeDirs = @(
        (Join-Path $env:ProgramFiles "nodejs"),
        (Join-Path ${env:ProgramFiles(x86)} "nodejs"),
        (Join-Path $localAppData "Programs\nodejs")
    ) | Where-Object { $_ -and (Test-Path (Join-Path $_ "node.exe")) }

    $wingetNodeRoot = Join-Path $localAppData "Microsoft\WinGet\Packages"
    if (Test-Path $wingetNodeRoot) {
        $wingetMatches = Get-ChildItem -Path $wingetNodeRoot -Directory -Filter "OpenJS.NodeJS.LTS*" -ErrorAction SilentlyContinue |
            ForEach-Object {
                Get-ChildItem -Path $_.FullName -Directory -ErrorAction SilentlyContinue |
                    Where-Object { Test-Path (Join-Path $_.FullName "node.exe") } |
                    Select-Object -ExpandProperty FullName
            }

        $candidateNodeDirs += $wingetMatches
    }

    $nodeCommand = Get-Command node -ErrorAction SilentlyContinue
    if ($nodeCommand) {
        $candidateNodeDirs += Split-Path -Parent $nodeCommand.Source
    }

    $nodeDir = $candidateNodeDirs |
        Where-Object { $_ } |
        Select-Object -Unique |
        Select-Object -First 1

    if (-not $nodeDir) {
        throw @"
Node.js nao foi encontrado nesta maquina.

Instale o Node.js LTS (recomendado: 24.x) e rode este script novamente.
Sugestao via winget:
  winget install OpenJS.NodeJS.LTS
"@
    }

    return $nodeDir
}

function Get-NodeMajorVersion {
    param(
        [Parameter(Mandatory = $true)]
        [string]$NodeExe
    )

    $versionOutput = & $NodeExe --version
    if ($LASTEXITCODE -ne 0 -or -not $versionOutput) {
        throw "Nao foi possivel ler a versao do Node.js em $NodeExe."
    }

    return [int](($versionOutput -replace '^v', '').Split('.')[0])
}

function Assert-NodeVersionSupported {
    param(
        [Parameter(Mandatory = $true)]
        [string]$NodeExe
    )

    $nodeMajorVersion = Get-NodeMajorVersion -NodeExe $NodeExe
    if ($nodeMajorVersion -lt 24) {
        throw @"
Node.js $nodeMajorVersion detectado, mas este projeto foi validado com Node.js 24.x ou superior.

Atualize o Node.js LTS e tente novamente.
"@
    }
}

function Invoke-Npm {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments
    )

    & $script:npmCmd @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Falha ao executar npm $($Arguments -join ' ')."
    }
}

$nodeDir = Resolve-NodeInstallation
$nodeExe = Join-Path $nodeDir "node.exe"
$script:npmCmd = Join-Path $nodeDir "npm.cmd"

if (-not (Test-Path $script:npmCmd)) {
    throw "npm.cmd nao foi encontrado em $nodeDir."
}

Assert-NodeVersionSupported -NodeExe $nodeExe

$env:Path = "$nodeDir;$env:Path"
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue

Set-Location $frontendDir

$shouldInstallDependencies =
    $Install -or
    -not (Test-Path $nodeModulesDir) -or
    -not (Test-Path $electronBuilderCmd) -or
    -not (Test-Path $npmPackageLock)

if ($shouldInstallDependencies) {
    Write-Host "Instalando dependencias do frontend..."
    Invoke-Npm -Arguments @("install", "--include=dev")
}

if ($Build) {
    Write-Host "Gerando pacote desktop..."
    Invoke-Npm -Arguments @("run", "build:desktop")
    Write-Host "Pacote concluido em frontend/release."
    exit 0
}

Write-Host "Abrindo ORION Console em modo de desenvolvimento..."
Invoke-Npm -Arguments @("run", "desktop:dev")
