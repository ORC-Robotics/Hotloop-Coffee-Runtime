param(
    [switch]$Install,
    [switch]$Build
)

$ErrorActionPreference = "Stop"

$workspaceRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$frontendDir = Join-Path $workspaceRoot "frontend"

$candidateNodeDirs = @(
    "C:\Users\OLIMPIADAS\AppData\Local\Microsoft\WinGet\Packages\OpenJS.NodeJS.LTS_Microsoft.Winget.Source_8wekyb3d8bbwe\node-v24.14.1-win-x64",
    "C:\Program Files\nodejs",
    "C:\Users\OLIMPIADAS\AppData\Local\Programs\nodejs"
)

$nodeDir = $candidateNodeDirs | Where-Object { Test-Path (Join-Path $_ "node.exe") } | Select-Object -First 1

if (-not $nodeDir) {
    $nodeCommand = Get-Command node -ErrorAction SilentlyContinue
    if ($nodeCommand) {
        $nodeDir = Split-Path -Parent $nodeCommand.Source
    }
}

if (-not $nodeDir) {
    throw "Node.js nao encontrado nesta maquina."
}

$env:Path = "$nodeDir;$env:Path"
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
$npmCmd = Join-Path $nodeDir "npm.cmd"
$electronBuilderCmd = Join-Path $frontendDir "node_modules\.bin\electron-builder.cmd"

if (-not (Test-Path $npmCmd)) {
    $npmCmd = "npm.cmd"
}

Set-Location $frontendDir

if ($Install -or -not (Test-Path (Join-Path $frontendDir "node_modules")) -or -not (Test-Path $electronBuilderCmd)) {
    & $npmCmd install --include=dev
    if ($LASTEXITCODE -ne 0) {
        throw "Falha ao instalar dependencias do frontend."
    }
}

if ($Build) {
    & $npmCmd run build:desktop
    if ($LASTEXITCODE -ne 0) {
        throw "Falha ao gerar o pacote desktop."
    }
    exit 0
}

& $npmCmd run desktop:dev
