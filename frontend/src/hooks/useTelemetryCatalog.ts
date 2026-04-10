import { startTransition, useEffect, useEffectEvent, useState } from 'react'
import { subscribeTelemetryCatalog } from '../data/telemetryGateway'
import { useTelemetryMode } from '../telemetry-mode/useTelemetryMode'
import type { BridgeStatus, TelemetryCatalogFeed, TelemetryCatalogStats, TelemetryTopicScope } from '../types/telemetry'

const POLL_MS = 900

function createFallbackScopeCounts(): Record<TelemetryTopicScope, number> {
  return {
    telemetry: 0,
    debug: 0,
    config: 0,
    'auto-mode': 0,
    other: 0,
  }
}

function createFallbackStats(): TelemetryCatalogStats {
  return {
    online: false,
    team: 0,
    totalTopics: 0,
    groupCount: 0,
    scopeCounts: createFallbackScopeCounts(),
  }
}

function createFallbackBridgeStatus(): BridgeStatus {
  return {
    transport: 'networktables',
    chooserPath: 'SmartDashboard/Auto mode',
    telemetryEndpoint: '/api/telemetry',
    controlModeEndpoint: '/api/control-mode',
    topicCatalogEndpoint: '/api/topics',
    topicWriteEndpoint: '/api/topics/write',
    connected: false,
    message: 'Waiting for the telemetry bridge.',
  }
}

function createFallbackCatalog(): TelemetryCatalogFeed {
  return {
    timestamp: new Date().toISOString(),
    topics: [],
    stats: createFallbackStats(),
    bridgeStatus: createFallbackBridgeStatus(),
  }
}

export function useTelemetryCatalog(onCatalog?: (catalog: TelemetryCatalogFeed) => void) {
  const { mode } = useTelemetryMode()
  const [catalog, setCatalog] = useState<TelemetryCatalogFeed>(createFallbackCatalog())
  const handleCatalog = useEffectEvent((incoming: TelemetryCatalogFeed) => {
    onCatalog?.(incoming)
  })

  useEffect(() => {
    setCatalog(createFallbackCatalog())

    return subscribeTelemetryCatalog(
      (incoming) => {
        handleCatalog(incoming)
        startTransition(() => {
          setCatalog(incoming)
        })
      },
      () => {
        setCatalog((previous) => ({
          ...previous,
          stats: {
            ...previous.stats,
            online: false,
          },
          bridgeStatus: {
            ...(previous.bridgeStatus ?? createFallbackBridgeStatus()),
            connected: false,
            message: previous.topics.length
              ? 'Bridge offline. Showing the latest cached topic catalog.'
              : 'Waiting for the live telemetry catalog.',
          },
        }))
      },
      POLL_MS,
    )
  }, [handleCatalog, mode])

  return catalog
}
