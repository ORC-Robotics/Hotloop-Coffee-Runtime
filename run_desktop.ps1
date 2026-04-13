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

function Test-ExecutablePath {
    param(
        [string]$Path
    )

    if (-not $Path) {
        return $false
    }

    try {
        return Test-Path -LiteralPath $Path -PathType Leaf -ErrorAction Stop
    }
    catch {
        return $false
    }
}

function Test-NodeInstallationDirectory {
    param(
        [string]$Directory
    )

    if (-not $Directory) {
        return $false
    }

    $nodeExeCandidate = Join-Path $Directory "node.exe"
    $npmCmdCandidate = Join-Path $Directory "npm.cmd"
    return (Test-ExecutablePath -Path $nodeExeCandidate) -and (Test-ExecutablePath -Path $npmCmdCandidate)
}

function Resolve-NodeToolchainFromDirectory {
    param(
        [string]$Directory
    )

    if (-not (Test-NodeInstallationDirectory -Directory $Directory)) {
        return $null
    }

    $nodeExeCandidate = Join-Path $Directory "node.exe"
    $npmCmdCandidate = Join-Path $Directory "npm.cmd"

    try {
        $nodeVersionOutput = & $nodeExeCandidate --version 2>$null
        if ($LASTEXITCODE -ne 0 -or -not $nodeVersionOutput) {
            return $null
        }

        $npmVersionOutput = & $npmCmdCandidate --version 2>$null
        if ($LASTEXITCODE -ne 0 -or -not $npmVersionOutput) {
            return $null
        }
    }
    catch {
        return $null
    }

    return [PSCustomObject]@{
        Directory   = $Directory
        NodeExe     = $nodeExeCandidate
        NpmCmd      = $npmCmdCandidate
        NodeVersion = $nodeVersionOutput
        NpmVersion  = $npmVersionOutput
    }
}

function Resolve-NodeToolchainFromCommands {
    $nodeCommand = Get-Command node -ErrorAction SilentlyContinue | Select-Object -First 1
    $npmCommand = Get-Command npm -ErrorAction SilentlyContinue | Select-Object -First 1

    if (-not $nodeCommand -or -not $npmCommand) {
        return $null
    }

    $nodeExeCandidate =
        if ($nodeCommand.Source) { $nodeCommand.Source }
        elseif ($nodeCommand.Path) { $nodeCommand.Path }
        else { $nodeCommand.Definition }

    $npmCmdCandidate =
        if ($npmCommand.Source) { $npmCommand.Source }
        elseif ($npmCommand.Path) { $npmCommand.Path }
        else { $npmCommand.Definition }

    if (-not (Test-ExecutablePath -Path $nodeExeCandidate) -or -not (Test-ExecutablePath -Path $npmCmdCandidate)) {
        return $null
    }

    try {
        $nodeVersionOutput = & $nodeExeCandidate --version 2>$null
        if ($LASTEXITCODE -ne 0 -or -not $nodeVersionOutput) {
            return $null
        }

        $npmVersionOutput = & $npmCmdCandidate --version 2>$null
        if ($LASTEXITCODE -ne 0 -or -not $npmVersionOutput) {
            return $null
        }
    }
    catch {
        return $null
    }

    return [PSCustomObject]@{
        Directory   = Split-Path -Parent $nodeExeCandidate
        NodeExe     = $nodeExeCandidate
        NpmCmd      = $npmCmdCandidate
        NodeVersion = $nodeVersionOutput
        NpmVersion  = $npmVersionOutput
    }
}

function Resolve-NodeInstallation {
    $commandToolchain = Resolve-NodeToolchainFromCommands
    if ($commandToolchain) {
        return $commandToolchain
    }

    $candidateNodeDirs = @(
        (Join-Path $env:ProgramFiles "nodejs"),
        (Join-Path ${env:ProgramFiles(x86)} "nodejs"),
        (Join-Path $localAppData "Programs\nodejs"),
        (Join-Path $localAppData "Microsoft\WinGet\Links")
    ) | Where-Object { Test-NodeInstallationDirectory -Directory $_ }

    $wingetNodeRoot = Join-Path $localAppData "Microsoft\WinGet\Packages"
    if (Test-Path $wingetNodeRoot) {
        $wingetMatches = Get-ChildItem -Path $wingetNodeRoot -Directory -Filter "OpenJS.NodeJS.LTS*" -ErrorAction SilentlyContinue |
            ForEach-Object {
                Get-ChildItem -Path $_.FullName -Directory -ErrorAction SilentlyContinue |
                    Where-Object { Test-NodeInstallationDirectory -Directory $_.FullName } |
                    Select-Object -ExpandProperty FullName
            }

        $candidateNodeDirs += $wingetMatches
    }

    $nodeCommand = Get-Command node -ErrorAction SilentlyContinue
    if ($nodeCommand) {
        $resolvedNodeDir = Split-Path -Parent $nodeCommand.Source
        if (Test-NodeInstallationDirectory -Directory $resolvedNodeDir) {
            $candidateNodeDirs += $resolvedNodeDir
        }
    }

    $nodeToolchain = $candidateNodeDirs |
        Where-Object { $_ } |
        Select-Object -Unique |
        ForEach-Object { Resolve-NodeToolchainFromDirectory -Directory $_ } |
        Where-Object { $_ } |
        Select-Object -First 1

    if (-not $nodeToolchain) {
        throw @"
Node.js nao foi encontrado nesta maquina.

Instale o Node.js LTS (recomendado: 24.x) e rode este script novamente.
Sugestao via winget:
  winget install OpenJS.NodeJS.LTS
"@
    }

    return $nodeToolchain
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

$nodeToolchain = Resolve-NodeInstallation
$nodeDir = $nodeToolchain.Directory
$nodeExe = $nodeToolchain.NodeExe
$script:npmCmd = $nodeToolchain.NpmCmd

if (-not (Test-ExecutablePath -Path $script:npmCmd)) {
    throw @"
Node.js foi encontrado, mas a instalacao esta incompleta ou inacessivel em:
  $nodeDir

O launcher precisa de node.exe e npm.cmd no mesmo diretorio.
Se voce instalou via WinGet e essa pasta estiver quebrada, repare ou reinstale:
  winget uninstall OpenJS.NodeJS.LTS
  winget install OpenJS.NodeJS.LTS
"@
}

Assert-NodeVersionSupported -NodeExe $nodeExe

$toolchainDirs = @(
    (Split-Path -Parent $nodeExe),
    (Split-Path -Parent $script:npmCmd)
) | Where-Object { $_ } | Select-Object -Unique

$env:Path = "$(($toolchainDirs -join ';'));$env:Path"
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
