import { useEffect, useState } from 'react'
import { getControlModes, requestControlModeChange } from '../data/telemetryGateway'
import { useTelemetryMode } from '../telemetry-mode/useTelemetryMode'
import type { BridgeStatus, ControlModeState } from '../types/telemetry'

const POLL_MS = 700

function createFallbackControlMode(): ControlModeState {
  return {
    availableModes: [],
    currentModeId: null,
    requestedModeId: null,
    syncStatus: 'unavailable',
    message: 'Waiting for AUTOMODE bridge.',
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
    remoteDriverEndpoint: '/api/remote-driver',
    connected: false,
    robotLinkConnected: false,
    teamNumber: 0,
    manualHost: null,
    connectionPreference: 'team-auto',
    message: 'Waiting for bridge backend.',
  }
}

export function useControlMode() {
  const { mode } = useTelemetryMode()
  const [controlMode, setControlMode] = useState<ControlModeState>(createFallbackControlMode())
  const [bridgeStatus, setBridgeStatus] = useState<BridgeStatus>(createFallbackBridgeStatus())
  const [selectedModeId, setSelectedModeId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const sync = async () => {
      try {
        const response = await getControlModes()
        if (cancelled) {
          return
        }

        setControlMode(response.controlMode)
        if (response.bridgeStatus) {
          setBridgeStatus(response.bridgeStatus)
        }

        setSelectedModeId((previous) => {
          if (previous) {
            return previous
          }

          return response.controlMode.requestedModeId ?? response.controlMode.currentModeId ?? null
        })
      } catch {
        if (cancelled) {
          return
        }

        setBridgeStatus((previous) => ({
          ...previous,
          connected: false,
          robotLinkConnected: false,
          message: 'Bridge backend unavailable. AUTOMODE sync is paused.',
        }))
        setControlMode((previous) => ({
          ...previous,
          syncStatus: previous.lastSyncAt ? 'stale' : 'unavailable',
          message: previous.lastSyncAt
            ? 'Aguardando sincronizacao com o bridge do AUTOMODE.'
            : 'Bridge do AUTOMODE indisponivel.',
        }))
      }
    }

    void sync()
    const interval = window.setInterval(() => {
      void sync()
    }, POLL_MS)

    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [mode])

  const applyRequestedMode = async (modeId = selectedModeId) => {
    if (!modeId) {
      return
    }

    try {
      const response = await requestControlModeChange(modeId)
      setControlMode(response.controlMode)
      if (response.bridgeStatus) {
        setBridgeStatus(response.bridgeStatus)
      }
      setSelectedModeId(response.controlMode.requestedModeId ?? response.controlMode.currentModeId ?? modeId)
    } catch {
      setBridgeStatus((previous) => ({
        ...previous,
        connected: false,
        robotLinkConnected: false,
        message: 'Bridge backend unavailable. Failed to publish the automode request.',
      }))
      setControlMode((previous) => ({
        ...previous,
        syncStatus: previous.lastSyncAt ? 'stale' : 'unavailable',
        message: 'Falha ao enviar comando para o bridge do AUTOMODE.',
      }))
    }
  }

  return {
    controlMode,
    bridgeStatus,
    selectedModeId,
    setSelectedModeId,
    applyRequestedMode,
  }
}
