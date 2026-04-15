import * as onlineDataSource from './robotBridge'
import * as simulationDataSource from './simulationDataSource'
import { getTelemetryMode } from '../telemetry-mode/telemetryModeStore'
import type { SpatialSnapshot } from '../types/telemetry'

function activeSource() {
  return getTelemetryMode() === 'offline' ? simulationDataSource : onlineDataSource
}

export async function getSpatialSnapshot(): Promise<SpatialSnapshot> {
  return activeSource().getSpatialSnapshot()
}

export function subscribeSpatialTelemetry(
  onSnapshot: (snapshot: SpatialSnapshot) => void,
  onError: () => void,
  intervalMs: number,
) {
  return activeSource().subscribeSpatialTelemetry(onSnapshot, onError, intervalMs)
}
