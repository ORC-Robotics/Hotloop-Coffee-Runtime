import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const frontendDir = path.resolve(__dirname, '..')
const electronBinary =
  process.platform === 'win32'
    ? path.join(frontendDir, 'node_modules', '.bin', 'electron.cmd')
    : path.join(frontendDir, 'node_modules', '.bin', 'electron')

const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE

const child =
  process.platform === 'win32'
    ? spawn('cmd.exe', ['/d', '/s', '/c', electronBinary, '.'], {
        cwd: frontendDir,
        env,
        stdio: 'inherit',
        windowsHide: false,
      })
    : spawn(electronBinary, ['.'], {
        cwd: frontendDir,
        env,
        stdio: 'inherit',
        windowsHide: false,
      })

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }

  process.exit(code ?? 0)
})
