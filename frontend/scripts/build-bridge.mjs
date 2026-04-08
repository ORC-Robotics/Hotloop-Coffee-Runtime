import { existsSync, mkdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const frontendDir = path.resolve(__dirname, '..')
const repoRoot = path.resolve(frontendDir, '..')
const bridgeSource = path.join(repoRoot, 'telemetry_bridge.py')
const requirementsPath = path.join(repoRoot, 'requirements.txt')
const projectVenvPython = process.platform === 'win32'
  ? path.join(repoRoot, '.venv', 'Scripts', 'python.exe')
  : path.join(repoRoot, '.venv', 'bin', 'python')
const bridgeDistDir = path.join(frontendDir, 'bridge-dist')
const pyInstallerRoot = path.join(frontendDir, '.pyinstaller')
const pyInstallerWorkDir = path.join(pyInstallerRoot, 'build')
const pyInstallerSpecDir = path.join(pyInstallerRoot, 'spec')
const venvDir = path.join(repoRoot, '.venv-bridge-build')

function getPythonExecutable(venvPath) {
  return process.platform === 'win32'
    ? path.join(venvPath, 'Scripts', 'python.exe')
    : path.join(venvPath, 'bin', 'python')
}

function run(command, args, options = {}) {
  const printable = [command, ...args].join(' ')
  console.log(`> ${printable}`)

  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    ...options,
  })

  if (result.error) {
    throw result.error
  }

  if (result.status !== 0) {
    throw new Error(`Command failed with exit code ${result.status}: ${printable}`)
  }
}

function canRun(command, args = []) {
  const result = spawnSync(command, [...args, '--version'], {
    stdio: 'ignore',
  })

  if (result.error) {
    return false
  }

  return result.status === 0
}

function resolvePythonLauncher() {
  if (process.env.ORION_PYTHON_EXECUTABLE) {
    return { command: process.env.ORION_PYTHON_EXECUTABLE, args: [] }
  }

  if (existsSync(projectVenvPython)) {
    return { command: projectVenvPython, args: [] }
  }

  if (process.platform === 'win32') {
    if (canRun('py', ['-3'])) {
      return { command: 'py', args: ['-3'] }
    }

    if (canRun('python')) {
      return { command: 'python', args: [] }
    }
  }

  if (canRun('python3')) {
    return { command: 'python3', args: [] }
  }

  if (canRun('python')) {
    return { command: 'python', args: [] }
  }

  throw new Error('Python 3 nao encontrado para gerar o bridge standalone.')
}

function ensureDirectories() {
  mkdirSync(bridgeDistDir, { recursive: true })
  mkdirSync(pyInstallerWorkDir, { recursive: true })
  mkdirSync(pyInstallerSpecDir, { recursive: true })
}

function stopExistingBridgeProcesses() {
  if (process.platform !== 'win32') {
    return
  }

  const result = spawnSync('taskkill', ['/F', '/IM', 'orion-telemetry-bridge.exe'], {
    stdio: 'ignore',
  })

  if (result.error) {
    throw result.error
  }
}

function ensureVirtualEnv(pythonLauncher) {
  const venvPython = getPythonExecutable(venvDir)

  if (!existsSync(venvPython)) {
    run(pythonLauncher.command, [...pythonLauncher.args, '-m', 'venv', venvDir])
  }

  return venvPython
}

function buildBridgeBinary() {
  const pythonLauncher = resolvePythonLauncher()
  const venvPython = ensureVirtualEnv(pythonLauncher)

  ensureDirectories()

  run(venvPython, ['-m', 'pip', 'install', '--upgrade', 'pip'])
  run(venvPython, ['-m', 'pip', 'install', '-r', requirementsPath, 'pyinstaller'])

  stopExistingBridgeProcesses()
  rmSync(path.join(bridgeDistDir, 'orion-telemetry-bridge.exe'), { force: true })

  run(venvPython, [
    '-m',
    'PyInstaller',
    '--noconfirm',
    '--clean',
    '--onefile',
    '--name',
    'orion-telemetry-bridge',
    '--distpath',
    bridgeDistDir,
    '--workpath',
    pyInstallerWorkDir,
    '--specpath',
    pyInstallerSpecDir,
    bridgeSource,
  ])
}

buildBridgeBinary()
