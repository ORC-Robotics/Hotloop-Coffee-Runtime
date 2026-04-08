import { useEffect, useMemo, useState } from 'react'
import { getTelemetrySnapshot, subscribeTelemetry } from '../data/robotBridge'
import { createOfflineSnapshot, generateMockTelemetryFrame } from '../data/mockTelemetry'
import { deriveAlerts, deriveTelemetryState } from '../lib/alertRules'
import type { TelemetryFeed, TelemetrySnapshot } from '../types/telemetry'

const TICK_MS = 350
const TELEMETRY_MODE =
  import.meta.env.VITE_TELEMETRY_MODE === 'mock'
    ? 'mock'
    : import.meta.env.VITE_TELEMETRY_MODE === 'offline'
      ? 'offline-standby'
      : 'bridge'

function mergeIncomingSnapshot(
  previous: TelemetrySnapshot,
  incoming: TelemetrySnapshot,
): TelemetrySnapshot {
  if (!incoming.connection.online && !previous.connection.online) {
    return {
      ...incoming,
      timestamp: previous.timestamp,
    }
  }

  return incoming
}

function toBridgeOfflineSnapshot(previous?: TelemetrySnapshot): TelemetrySnapshot {
  const offline = createOfflineSnapshot()

  if (!previous) {
    return offline
  }

  return {
    ...offline,
    timestamp: previous.connection.online ? new Date().toISOString() : previous.timestamp,
    bridgeStatus: previous.bridgeStatus,
    controlMode: previous.controlMode,
    connection: {
      ...offline.connection,
      team: previous.connection.team,
      target: previous.connection.target,
      mode: previous.connection.mode === 'mock-bridge' ? 'team-auto' : previous.connection.mode,
    },
  }
}

export function useTelemetry(): TelemetryFeed {
  const [snapshot, setSnapshot] = useState(() =>
    TELEMETRY_MODE === 'mock' ? generateMockTelemetryFrame(Date.now()) : createOfflineSnapshot(),
  )

  useEffect(() => {
    if (TELEMETRY_MODE !== 'mock') {
      return
    }

    const interval = window.setInterval(() => {
      setSnapshot(generateMockTelemetryFrame(Date.now()))
    }, TICK_MS)

    return () => {
      window.clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    if (TELEMETRY_MODE !== 'bridge') {
      return
    }

    return subscribeTelemetry(
      (incoming) => {
        setSnapshot((previous) => mergeIncomingSnapshot(previous, incoming))
      },
      () => {
        setSnapshot((previous) => {
          if (!previous.connection.online) {
            return previous
          }

          return toBridgeOfflineSnapshot(previous)
        })
      },
      TICK_MS,
    )
  }, [])

  useEffect(() => {
    if (TELEMETRY_MODE !== 'bridge') {
      return
    }

    void getTelemetrySnapshot()
  }, [])

  const alerts = useMemo(() => deriveAlerts(snapshot), [snapshot])
  const derived = useMemo(() => deriveTelemetryState(snapshot, alerts), [alerts, snapshot])

  return {
    snapshot,
    alerts,
    derived,
  }
}
