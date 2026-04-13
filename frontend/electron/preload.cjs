const { contextBridge, ipcRenderer } = require('electron')

const bridgeHost = process.env.ORION_BRIDGE_HOST ?? '127.0.0.1'
const bridgePort = process.env.ORION_BRIDGE_PORT ?? '8765'

contextBridge.exposeInMainWorld('orionDesktop', {
  isElectron: true,
  bridgeBaseUrl: `http://${bridgeHost}:${bridgePort}`,
  restartBridge: () => ipcRenderer.invoke('orion:restart-bridge'),
  platform: process.platform,
  versions: {
    chrome: process.versions.chrome,
    electron: process.versions.electron,
    node: process.versions.node,
  },
})
