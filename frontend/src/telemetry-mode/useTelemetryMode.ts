import { useSyncExternalStore } from 'react'
import {
  getTelemetryMode,
  setTelemetryMode,
  subscribeTelemetryMode,
  type TelemetryMode,
} from './telemetryModeStore'

export function useTelemetryMode(): {
  mode: TelemetryMode
  isSimulation: boolean
  setMode: (mode: TelemetryMode) => void
} {
  const mode = useSyncExternalStore(subscribeTelemetryMode, getTelemetryMode, getTelemetryMode)

  return {
    mode,
    isSimulation: mode === 'offline',
    setMode: setTelemetryMode,
  }
}
