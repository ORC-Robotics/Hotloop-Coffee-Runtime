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
const tempRoot = path.join(repoRoot, '.tmp', 'python-build')

function getPythonExecutable(venvPath) {
  return process.platform === 'win32'
    ? path.join(venvPath, 'Scripts', 'python.exe')
    : path.join(venvPath, 'bin', 'python')
}

function getTempEnv() {
  return {
    ...process.env,
    TEMP: tempRoot,
    TMP: tempRoot,
  }
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

function canRun(command, args = [], options = {}) {
  const result = spawnSync(command, [...args, '--version'], {
    stdio: 'ignore',
    ...options,
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
  mkdirSync(tempRoot, { recursive: true })
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
  const tempEnv = getTempEnv()

  if (!existsSync(venvPython)) {
    try {
      run(pythonLauncher.command, [...pythonLauncher.args, '-m', 'venv', venvDir], {
        env: tempEnv,
      })
    } catch (error) {
      console.warn(
        `! Falha ao criar a virtualenv do bridge; usando o Python do sistema como fallback.\n${error.message}`,
      )
      return null
    }
  }

  if (!canRun(venvPython, ['-m', 'pip'], { env: tempEnv })) {
    console.warn('! A virtualenv do bridge foi criada sem pip; usando o Python do sistema como fallback.')
    return null
  }

  return { command: venvPython, args: [] }
}

function resolveBuildPython() {
  const pythonLauncher = resolvePythonLauncher()
  const venvLauncher = ensureVirtualEnv(pythonLauncher)

  if (venvLauncher) {
    return venvLauncher
  }

  if (!canRun(pythonLauncher.command, [...pythonLauncher.args, '-m', 'pip'], { env: getTempEnv() })) {
    throw new Error(
      'Python encontrado, mas o pip nao esta disponivel para instalar as dependencias do bridge.',
    )
  }

  return pythonLauncher
}

function buildBridgeBinary() {
  ensureDirectories()

  const pythonLauncher = resolveBuildPython()
  const tempEnv = getTempEnv()

  run(pythonLauncher.command, [...pythonLauncher.args, '-m', 'pip', 'install', '--upgrade', 'pip'], {
    env: tempEnv,
  })
  run(
    pythonLauncher.command,
    [...pythonLauncher.args, '-m', 'pip', 'install', '-r', requirementsPath, 'pyinstaller'],
    { env: tempEnv },
  )

  stopExistingBridgeProcesses()
  rmSync(path.join(bridgeDistDir, 'orion-telemetry-bridge.exe'), { force: true })

  run(
    pythonLauncher.command,
    [
      ...pythonLauncher.args,
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
    ],
    { env: tempEnv },
  )
}

buildBridgeBinary()
