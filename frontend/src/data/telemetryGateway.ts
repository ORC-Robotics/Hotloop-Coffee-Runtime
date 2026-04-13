import * as onlineDataSource from './robotBridge'
import * as simulationDataSource from './simulationDataSource'
import { getTelemetryMode } from '../telemetry-mode/telemetryModeStore'
import type {
  BridgeConnectionPreference,
  BridgeConnectionResponse,
  ControlModeFeed,
  RemoteDriverAction,
  RemoteDriverResponse,
  RemoteDriverSessionMode,
  RemoteDriverStateCommand,
  TelemetryCatalogFeed,
  TelemetrySnapshot,
  TopicWriteCommand,
  TopicWriteResponse,
} from '../types/telemetry'

function activeSource() {
  return getTelemetryMode() === 'offline' ? simulationDataSource : onlineDataSource
}

export async function getTelemetrySnapshot(): Promise<TelemetrySnapshot> {
  return activeSource().getTelemetrySnapshot()
}

export function subscribeTelemetry(
  onSnapshot: (snapshot: TelemetrySnapshot) => void,
  onError: () => void,
  intervalMs: number,
) {
  return activeSource().subscribeTelemetry(onSnapshot, onError, intervalMs)
}

export async function getTelemetryCatalog(): Promise<TelemetryCatalogFeed> {
  return activeSource().getTelemetryCatalog()
}

export function subscribeTelemetryCatalog(
  onCatalog: (catalog: TelemetryCatalogFeed) => void,
  onError: () => void,
  intervalMs: number,
) {
  return activeSource().subscribeTelemetryCatalog(onCatalog, onError, intervalMs)
}

export async function getControlModes(): Promise<ControlModeFeed> {
  return activeSource().getControlModes()
}

export async function requestControlModeChange(modeId: string): Promise<ControlModeFeed> {
  return activeSource().requestControlModeChange(modeId)
}

export async function getRemoteDriverStatus() {
  return activeSource().getRemoteDriverStatus()
}

export async function sendRemoteDriverState(
  payload: RemoteDriverStateCommand['payload'],
): Promise<RemoteDriverResponse> {
  return activeSource().sendRemoteDriverState(payload)
}

export async function sendRemoteDriverAction(
  action: RemoteDriverAction,
  source: string,
  sessionMode?: RemoteDriverSessionMode,
): Promise<RemoteDriverResponse> {
  return activeSource().sendRemoteDriverAction(action, source, sessionMode)
}

export async function getBridgeConnectionStatus(): Promise<BridgeConnectionResponse> {
  return activeSource().getBridgeConnectionStatus()
}

export async function updateBridgeConnection(
  manualHost?: string | null,
  connectionPreference?: BridgeConnectionPreference,
  reconnect = true,
): Promise<BridgeConnectionResponse> {
  return activeSource().updateBridgeConnection(manualHost, connectionPreference, reconnect)
}

export async function writeTelemetryTopicValue(
  key: string,
  valueKind: TopicWriteCommand['payload']['valueKind'],
  value: TopicWriteCommand['payload']['value'],
): Promise<TopicWriteResponse> {
  return activeSource().writeTelemetryTopicValue(key, valueKind, value)
}
