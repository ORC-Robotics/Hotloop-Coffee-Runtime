import { useEffect, useState } from 'react'
import { getSpatialSnapshot, subscribeSpatialTelemetry } from '../data/spatialGateway'
import { createOfflineSpatialSnapshot } from '../data/mockTelemetry'
import { useTelemetryMode } from '../telemetry-mode/useTelemetryMode'
import type { SpatialSnapshot } from '../types/telemetry'

const TICK_MS = 150

function mergeIncomingSpatial(previous: SpatialSnapshot, incoming: SpatialSnapshot): SpatialSnapshot {
  if (!incoming.connection.online && !previous.connection.online) {
    return {
      ...incoming,
      timestamp: previous.timestamp,
    }
  }

  return incoming
}

function toBridgeOfflineSpatialSnapshot(previous?: SpatialSnapshot): SpatialSnapshot {
  const offline = createOfflineSpatialSnapshot()

  if (!previous) {
    return offline
  }

  return {
    ...offline,
    timestamp: previous.connection.online ? new Date().toISOString() : previous.timestamp,
    bridgeStatus: previous.bridgeStatus,
    connection: {
      ...offline.connection,
      team: previous.connection.team,
      target: previous.connection.target,
      mode: previous.connection.mode === 'mock-bridge' ? 'team-auto' : previous.connection.mode,
    },
    pose: previous.pose.available ? { ...previous.pose, freshness: 'stale' } : offline.pose,
    poseSources: {
      odometry: previous.poseSources.odometry.available
        ? { ...previous.poseSources.odometry, freshness: 'stale' }
        : offline.poseSources.odometry,
      reactive: previous.poseSources.reactive.available
        ? { ...previous.poseSources.reactive, freshness: 'stale' }
        : offline.poseSources.reactive,
      mapeamento: previous.poseSources.mapeamento.available
        ? { ...previous.poseSources.mapeamento, freshness: 'stale' }
        : offline.poseSources.mapeamento,
      simulation: previous.poseSources.simulation.available
        ? { ...previous.poseSources.simulation, freshness: 'stale' }
        : offline.poseSources.simulation,
    },
    lidar: previous.lidar.available ? { ...previous.lidar, freshness: 'stale' } : offline.lidar,
    stream: previous.stream,
  }
}

export function useSpatialTelemetry(): SpatialSnapshot {
  const { mode } = useTelemetryMode()
  const [snapshot, setSnapshot] = useState(() => createOfflineSpatialSnapshot())

  useEffect(() => {
    const unsubscribe = subscribeSpatialTelemetry(
      (incoming) => {
        setSnapshot((previous) => mergeIncomingSpatial(previous, incoming))
      },
      () => {
        setSnapshot((previous) => {
          if (!previous.connection.online) {
            return previous
          }

          return toBridgeOfflineSpatialSnapshot(previous)
        })
      },
      TICK_MS,
    )

    void getSpatialSnapshot()

    return unsubscribe
  }, [mode])

  return snapshot
}
