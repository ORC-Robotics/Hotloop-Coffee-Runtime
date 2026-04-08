param(
    [switch]$Build,
    [switch]$Install
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
$npmCmd = Join-Path $nodeDir "npm.cmd"

if (-not (Test-Path $npmCmd)) {
    $npmCmd = "npm.cmd"
}

Set-Location $frontendDir

if ($Install -or -not (Test-Path (Join-Path $frontendDir "node_modules"))) {
    & $npmCmd install
    if ($LASTEXITCODE -ne 0) {
        throw "Falha ao instalar dependencias do frontend."
    }
}

if ($Build) {
    & $npmCmd run build
    if ($LASTEXITCODE -ne 0) {
        throw "Falha no build do frontend."
    }
    exit 0
}

& $npmCmd run dev
