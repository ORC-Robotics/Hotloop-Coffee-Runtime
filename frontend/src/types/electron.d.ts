export {}

declare global {
  interface Window {
    orionDesktop?: {
      isElectron: boolean
      bridgeBaseUrl: string
      platform: string
      versions: {
        chrome: string
        electron: string
        node: string
      }
    }
  }
}
