import {
  adaptBackendTelemetry,
  adaptControlModePayload,
  adaptRemoteDriverPayload,
  adaptTelemetryCatalogPayload,
} from './telemetryAdapters'
import type {
  BridgeConnectionCommand,
  BridgeConnectionPreference,
  BridgeConnectionResponse,
  BridgeStatus,
  ControlModeFeed,
  OperatorCommand,
  RawBackendTelemetry,
  RawBridgeConnectionPayload,
  RawRemoteDriverPayload,
  RawTelemetryCatalogPayload,
  RemoteDriverAction,
  RemoteDriverActionCommand,
  RemoteDriverFeed,
  RemoteDriverResponse,
  RemoteDriverSessionMode,
  RemoteDriverStateCommand,
  TelemetryCatalogFeed,
  TelemetrySnapshot,
  TopicWriteCommand,
  TopicWriteResponse,
} from '../types/telemetry'

function resolveBridgeBaseUrl() {
  if (import.meta.env.VITE_TELEMETRY_API_URL_BASE) {
    return import.meta.env.VITE_TELEMETRY_API_URL_BASE
  }

  if (window.orionDesktop?.bridgeBaseUrl) {
    return window.orionDesktop.bridgeBaseUrl
  }

  if (window.location.protocol === 'file:') {
    return 'http://127.0.0.1:8765'
  }

  return `${window.location.protocol}//${window.location.hostname || '127.0.0.1'}:8765`
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
    discoveredCameraFeeds: [],
    message: 'Bridge status unavailable.',
  }
}

function adaptBridgeConnectionPayload(payload: RawBridgeConnectionPayload): BridgeConnectionResponse {
  return {
    bridgeStatus: payload.bridgeStatus
      ? { ...createFallbackBridgeStatus(), ...payload.bridgeStatus }
      : createFallbackBridgeStatus(),
    message: payload.message,
    error: payload.error,
  }
}

const BRIDGE_BASE_URL = resolveBridgeBaseUrl()

const TELEMETRY_URL = `${BRIDGE_BASE_URL}/api/telemetry`
const CONTROL_MODE_URL = `${BRIDGE_BASE_URL}/api/control-mode`
const TOPICS_URL = `${BRIDGE_BASE_URL}/api/topics`
const TOPIC_WRITE_URL = `${BRIDGE_BASE_URL}/api/topics/write`
const REMOTE_DRIVER_URL = `${BRIDGE_BASE_URL}/api/remote-driver`
const REMOTE_DRIVER_STATE_URL = `${BRIDGE_BASE_URL}/api/remote-driver/state`
const REMOTE_DRIVER_ACTION_URL = `${BRIDGE_BASE_URL}/api/remote-driver/action`
const BRIDGE_CONNECTION_URL = `${BRIDGE_BASE_URL}/api/bridge/connection`

export async function getTelemetrySnapshot(): Promise<TelemetrySnapshot> {
  const response = await fetch(TELEMETRY_URL, {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  })

  if (!response.ok) {
    throw new Error(`Telemetry bridge returned ${response.status}`)
  }

  const payload = (await response.json()) as RawBackendTelemetry
  return adaptBackendTelemetry(payload)
}

export function subscribeTelemetry(
  onSnapshot: (snapshot: TelemetrySnapshot) => void,
  onError: () => void,
  intervalMs: number,
) {
  let cancelled = false

  const tick = async () => {
    try {
      const snapshot = await getTelemetrySnapshot()
      if (!cancelled) {
        onSnapshot(snapshot)
      }
    } catch {
      if (!cancelled) {
        onError()
      }
    }
  }

  void tick()
  const interval = window.setInterval(() => {
    void tick()
  }, intervalMs)

  return () => {
    cancelled = true
    window.clearInterval(interval)
  }
}

export async function getTelemetryCatalog(): Promise<TelemetryCatalogFeed> {
  const response = await fetch(TOPICS_URL, {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  })

  if (!response.ok) {
    throw new Error(`Topic catalog endpoint returned ${response.status}`)
  }

  return adaptTelemetryCatalogPayload((await response.json()) as RawTelemetryCatalogPayload)
}

export function subscribeTelemetryCatalog(
  onCatalog: (catalog: TelemetryCatalogFeed) => void,
  onError: () => void,
  intervalMs: number,
) {
  let cancelled = false

  const tick = async () => {
    try {
      const catalog = await getTelemetryCatalog()
      if (!cancelled) {
        onCatalog(catalog)
      }
    } catch {
      if (!cancelled) {
        onError()
      }
    }
  }

  void tick()
  const interval = window.setInterval(() => {
    void tick()
  }, intervalMs)

  return () => {
    cancelled = true
    window.clearInterval(interval)
  }
}

export async function getControlModes(): Promise<ControlModeFeed> {
  const response = await fetch(CONTROL_MODE_URL, {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  })

  if (!response.ok) {
    throw new Error(`Control mode endpoint returned ${response.status}`)
  }

  return adaptControlModePayload((await response.json()) as ControlModeFeed)
}

export async function getRemoteDriverStatus(): Promise<RemoteDriverFeed> {
  const response = await fetch(REMOTE_DRIVER_URL, {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  })

  if (!response.ok) {
    throw new Error(`Remote driver endpoint returned ${response.status}`)
  }

  return adaptRemoteDriverPayload((await response.json()) as RawRemoteDriverPayload)
}

export async function writeTelemetryTopicValue(
  key: string,
  valueKind: TopicWriteCommand['payload']['valueKind'],
  value: TopicWriteCommand['payload']['value'],
): Promise<TopicWriteResponse> {
  const command: TopicWriteCommand = {
    type: 'write_topic_value',
    payload: {
      key,
      valueKind,
      value,
    },
  }

  const response = await fetch(TOPIC_WRITE_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  })

  const payload = (await response.json()) as TopicWriteResponse

  if (!response.ok) {
    return payload
  }

  return payload
}

export async function sendRemoteDriverState(
  payload: RemoteDriverStateCommand['payload'],
): Promise<RemoteDriverResponse> {
  const command: RemoteDriverStateCommand = {
    type: 'set_remote_driver_state',
    payload,
  }

  const response = await fetch(REMOTE_DRIVER_STATE_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  })

  const rawPayload = (await response.json()) as RawRemoteDriverPayload
  const adapted = adaptRemoteDriverPayload(rawPayload)

  return {
    ...adapted,
    message: rawPayload.message,
    error: rawPayload.error,
  }
}

export async function sendRemoteDriverAction(
  action: RemoteDriverAction,
  source: string,
  sessionMode?: RemoteDriverSessionMode,
): Promise<RemoteDriverResponse> {
  const command: RemoteDriverActionCommand = {
    type: 'send_remote_driver_action',
    payload: {
      action,
      source,
      sessionMode,
    },
  }

  const response = await fetch(REMOTE_DRIVER_ACTION_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  })

  const rawPayload = (await response.json()) as RawRemoteDriverPayload
  const adapted = adaptRemoteDriverPayload(rawPayload)

  return {
    ...adapted,
    message: rawPayload.message,
    error: rawPayload.error,
  }
}

export async function requestControlModeChange(modeId: string): Promise<ControlModeFeed> {
  const command: OperatorCommand = {
    type: 'set_control_mode',
    payload: { modeId },
  }

  const response = await fetch(CONTROL_MODE_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  })

  const payload = adaptControlModePayload((await response.json()) as ControlModeFeed)

  if (!response.ok) {
    return payload
  }

  return payload
}

export async function getBridgeConnectionStatus(): Promise<BridgeConnectionResponse> {
  const response = await fetch(BRIDGE_CONNECTION_URL, {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  })

  return adaptBridgeConnectionPayload((await response.json()) as RawBridgeConnectionPayload)
}

export async function updateBridgeConnection(
  manualHost?: string | null,
  connectionPreference?: BridgeConnectionPreference,
  reconnect = true,
): Promise<BridgeConnectionResponse> {
  const command: BridgeConnectionCommand = {
    type: 'update_bridge_connection',
    payload: {
      manualHost,
      connectionPreference,
      reconnect,
    },
  }

  const response = await fetch(BRIDGE_CONNECTION_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  })

  return adaptBridgeConnectionPayload((await response.json()) as RawBridgeConnectionPayload)
}
