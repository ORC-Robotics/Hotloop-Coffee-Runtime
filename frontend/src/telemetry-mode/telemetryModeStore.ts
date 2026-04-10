export type TelemetryMode = 'online' | 'offline'

const STORAGE_KEY = 'orion.telemetry-mode.v1'

type Listener = () => void

function resolveDefaultMode(): TelemetryMode {
  if (import.meta.env.VITE_TELEMETRY_MODE === 'offline' || import.meta.env.VITE_TELEMETRY_MODE === 'mock') {
    return 'offline'
  }

  return 'online'
}

function loadInitialMode(): TelemetryMode {
  if (typeof window === 'undefined') {
    return resolveDefaultMode()
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === 'online' || stored === 'offline') {
      return stored
    }
  } catch {
    // Fall back to the environment default when storage is unavailable.
  }

  return resolveDefaultMode()
}

let currentMode: TelemetryMode = loadInitialMode()
const listeners = new Set<Listener>()

function emitChange() {
  listeners.forEach((listener) => listener())
}

export function getTelemetryMode() {
  return currentMode
}

export function setTelemetryMode(mode: TelemetryMode) {
  if (mode === currentMode) {
    return
  }

  currentMode = mode

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, mode)
    } catch {
      // Ignore storage failures and keep the in-memory mode.
    }
  }

  emitChange()
}

export function subscribeTelemetryMode(listener: Listener) {
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}
