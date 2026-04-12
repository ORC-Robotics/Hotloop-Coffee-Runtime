import { useEffect, useMemo, useState } from 'react'
import { getTelemetrySnapshot, subscribeTelemetry } from '../data/telemetryGateway'
import { createOfflineSnapshot } from '../data/mockTelemetry'
import { deriveAlerts, deriveTelemetryState } from '../lib/alertRules'
import { useTelemetryMode } from '../telemetry-mode/useTelemetryMode'
import type { BatteryHistoryPoint, TelemetryFeed, TelemetrySnapshot } from '../types/telemetry'

const TICK_MS = 150
const BATTERY_HISTORY_INTERVAL_MS = 450
const MAX_BATTERY_POINTS = 48

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

function appendBatteryHistory(
  previous: BatteryHistoryPoint[],
  snapshot: TelemetrySnapshot,
): BatteryHistoryPoint[] {
  if (!snapshot.connection.online || snapshot.battery.voltageV <= 0) {
    return previous
  }

  const timestampMs = new Date(snapshot.timestamp).getTime()
  if (Number.isNaN(timestampMs)) {
    return previous
  }

  const lastPoint = previous[previous.length - 1]
  if (lastPoint) {
    const lastTimestampMs = new Date(lastPoint.timestamp).getTime()
    if (!Number.isNaN(lastTimestampMs) && timestampMs - lastTimestampMs < BATTERY_HISTORY_INTERVAL_MS) {
      return previous
    }
  }

  const next = [...previous, { timestamp: snapshot.timestamp, voltageV: snapshot.battery.voltageV }]
  return next.slice(-MAX_BATTERY_POINTS)
}

export function useTelemetry(): TelemetryFeed {
  const { mode } = useTelemetryMode()
  const [snapshot, setSnapshot] = useState(() => createOfflineSnapshot())
  const [batteryHistory, setBatteryHistory] = useState<BatteryHistoryPoint[]>([])

  useEffect(() => {
    const unsubscribe = subscribeTelemetry(
      (incoming) => {
        setSnapshot((previous) => mergeIncomingSnapshot(previous, incoming))
        setBatteryHistory((previous) => appendBatteryHistory(previous, incoming))
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

    void getTelemetrySnapshot()

    return unsubscribe
  }, [mode])

  const alerts = useMemo(() => deriveAlerts(snapshot), [snapshot])
  const derived = useMemo(() => deriveTelemetryState(snapshot, alerts), [alerts, snapshot])

  return {
    snapshot,
    alerts,
    derived,
    batteryHistory,
  }
}
