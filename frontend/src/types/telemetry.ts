export type AlertSeverity = 'critical' | 'warning' | 'info'
export type UiTone = 'good' | 'warning' | 'critical' | 'info' | 'neutral'
export type ConnectionMode = 'team-auto' | 'manual-fallback' | 'mock-bridge'
export type BridgeConnectionPreference = 'team-auto' | 'manual-host'
export type TelemetryTopicScope = 'telemetry' | 'debug' | 'config' | 'auto-mode' | 'other'
export type TelemetryTopicValueKind =
  | 'number'
  | 'boolean'
  | 'string'
  | 'number-array'
  | 'boolean-array'
  | 'string-array'
  | 'raw'
  | 'unknown'
export type ControlModeSyncStatus =
  | 'synced'
  | 'pending'
  | 'applied'
  | 'rejected'
  | 'stale'
  | 'unavailable'
export type RemoteDriverMode = 'disabled' | 'teleop' | 'autonomous'
export type RemoteDriverSessionMode = Extract<RemoteDriverMode, 'teleop' | 'autonomous'>
export type RemoteDriverAction =
  | 'start'
  | 'disable'
  | 'reset'
  | 'estop'
export type MockScenarioId =
  | 'corridor-cruise'
  | 'front-obstacle'
  | 'left-opening'
  | 'right-opening'
  | 'dead-end'
  | 'scan-instability'

export interface ConnectionStatus {
  online: boolean
  team: number
  target: string
  hostSeen: string
  mode: ConnectionMode
  routeLabel: string
  health: 'stable' | 'degraded' | 'unstable'
}

export interface HeadingData {
  yawDeg: number
  targetYawDeg: number
  angularErrorDeg: number
  lateralErrorM: number
}

export interface PerceptionData {
  frontMedianMm: number
  leftWallMm: number
  rightWallMm: number
  leftOpenMm: number
  rightOpenMm: number
  frontBlocked: boolean
  frontSlow: boolean
  leftOpenFlag: boolean
  rightOpenFlag: boolean
  deadEnd: boolean
}

export interface CommandData {
  center: number
  forward: number
  rotation: number
}

export interface EncoderData {
  leftMm: number
  rightMm: number
  backMm: number
  forwardDistanceCm: number
}

export interface SystemHealthData {
  lidarHealthy: boolean
  navxConnected: boolean
  validScan: boolean
  gyroHold: boolean
}

export interface BatteryData {
  voltageV: number
  currentA: number
  powerW: number
  stateOfCharge: number
  estimatedRuntimeMin: number | null
}

export interface BatteryHistoryPoint {
  timestamp: string
  voltageV: number
}

export interface ReactiveStateData {
  state: string
  decision: string
  driveControl: string
  lastTurn: string
  stateTimeSec: number
  stableScans: number
  pendingTurnDirection: string | null
  pendingTurnArmed: boolean | null
  turnDetected: boolean | null
  turnExecutable: boolean | null
}

export interface AlertItem {
  id: string
  severity: AlertSeverity
  source: 'connection' | 'perception' | 'systems' | 'heading' | 'reactive'
  title: string
  message: string
}

export interface RobotControlMode {
  id: string
  label: string
  description?: string | null
  isAvailable: boolean
}

export interface ControlModeState {
  availableModes: RobotControlMode[]
  currentModeId: string | null
  requestedModeId: string | null
  syncStatus: ControlModeSyncStatus
  lastSyncAt?: string
  lastCommandAt?: string
  message?: string
}

export interface RemoteDriverStatus {
  active: boolean
  mode: RemoteDriverMode
  heartbeatFresh: boolean
  heartbeatAgeSec: number | null
  source: string
  inputSource: string
  lastAction: string
  driveX: number
  driveY: number
  driveZ: number
  gyroAssist: boolean
  robotEnabled: boolean
  status: string
  lastPacketAt?: string
  lastActionAt?: string
}

export interface BridgeStatus {
  transport: string
  chooserPath: string
  telemetryEndpoint: string
  controlModeEndpoint: string
  topicCatalogEndpoint?: string
  topicWriteEndpoint?: string
  remoteDriverEndpoint?: string
  connected: boolean
  robotLinkConnected?: boolean
  teamNumber?: number
  manualHost?: string | null
  connectionPreference?: BridgeConnectionPreference
  lastSyncAt?: string
  message?: string
}

export type TelemetryTopicScalarValue = number | boolean | string | null
export type TelemetryTopicValue = TelemetryTopicScalarValue | TelemetryTopicScalarValue[]

export interface TelemetryTopic {
  key: string
  label: string
  scope: TelemetryTopicScope
  segments: string[]
  groupPath: string
  valueKind: TelemetryTopicValueKind
  value: TelemetryTopicValue
  valueText: string
  persistent: boolean
  isWritable: boolean
}

export interface TelemetryCatalogStats {
  online: boolean
  team: number
  totalTopics: number
  groupCount: number
  scopeCounts: Record<TelemetryTopicScope, number>
}

export interface TelemetryCatalogFeed {
  timestamp: string
  topics: TelemetryTopic[]
  stats: TelemetryCatalogStats
  bridgeStatus?: BridgeStatus
}

export type OperatorCommand = {
  type: 'set_control_mode'
  payload: { modeId: string }
}

export type TopicWriteCommand = {
  type: 'write_topic_value'
  payload: {
    key: string
    valueKind: Extract<TelemetryTopicValueKind, 'number' | 'boolean' | 'string'>
    value: number | boolean | string
  }
}

export type RemoteDriverStateCommand = {
  type: 'set_remote_driver_state'
  payload: {
    x: number
    y: number
    z: number
    gyroAssist: boolean
    source: string
    inputSource: string
  }
}

export type RemoteDriverActionCommand = {
  type: 'send_remote_driver_action'
  payload: {
    action: RemoteDriverAction
    source: string
    sessionMode?: RemoteDriverSessionMode
  }
}

export type BridgeConnectionCommand = {
  type: 'update_bridge_connection'
  payload: {
    manualHost?: string | null
    connectionPreference?: BridgeConnectionPreference
    reconnect?: boolean
  }
}

export interface TopicWriteResponse {
  topic?: TelemetryTopic
  message?: string
  error?: string
  bridgeStatus?: BridgeStatus
}

export interface RemoteDriverResponse {
  remoteDriver?: RemoteDriverStatus
  message?: string
  error?: string
  bridgeStatus?: BridgeStatus
}

export interface BridgeConnectionResponse {
  message?: string
  error?: string
  bridgeStatus?: BridgeStatus
}

export interface TelemetrySnapshot {
  timestamp: string
  scenarioId: MockScenarioId
  scenarioLabel: string
  bridgeStatus?: BridgeStatus
  controlMode?: ControlModeState
  connection: ConnectionStatus
  heading: HeadingData
  perception: PerceptionData
  commands: CommandData
  encoders: EncoderData
  systems: SystemHealthData
  battery: BatteryData
  reactive: ReactiveStateData
}

export interface TelemetryDerivedState {
  connectionTone: UiTone
  robotHealthTone: UiTone
  frontClearanceTone: UiTone
  alignmentTone: UiTone
  lastUpdatedLabel: string
  commandNarrative: string
  stateNarrative: string
}

export interface TelemetryFeed {
  snapshot: TelemetrySnapshot
  alerts: AlertItem[]
  derived: TelemetryDerivedState
  batteryHistory: BatteryHistoryPoint[]
}

export interface ControlModeFeed {
  controlMode: ControlModeState
  bridgeStatus?: BridgeStatus
}

export interface RemoteDriverFeed {
  remoteDriver: RemoteDriverStatus
  bridgeStatus?: BridgeStatus
}

export interface RawTelemetryCatalogPayload {
  timestamp?: string
  topics?: Partial<TelemetryTopic>[]
  stats?: Partial<TelemetryCatalogStats> & {
    scopeCounts?: Partial<Record<TelemetryTopicScope, number>>
  }
  bridgeStatus?: Partial<BridgeStatus>
}

export interface RawRemoteDriverPayload {
  remoteDriver?: Partial<RemoteDriverStatus>
  bridgeStatus?: Partial<BridgeStatus>
  message?: string
  error?: string
}

export interface RawBridgeConnectionPayload {
  bridgeStatus?: Partial<BridgeStatus>
  message?: string
  error?: string
}

export interface RawBackendTelemetry {
  timestamp?: string
  scenarioLabel?: string
  bridgeStatus?: Partial<BridgeStatus>
  controlMode?: Partial<ControlModeState>
  connection?: Partial<ConnectionStatus>
  heading?: Partial<HeadingData>
  perception?: Partial<PerceptionData>
  commands?: Partial<CommandData>
  encoders?: Partial<EncoderData>
  systems?: Partial<SystemHealthData>
  battery?: Partial<BatteryData>
  reactive?: Partial<ReactiveStateData>
}

export interface RawNetworkTablesPayload {
  team?: number
  mode?: ConnectionMode
  target?: string
  hostSeen?: string
  online?: boolean
  routeLabel?: string
  health?: ConnectionStatus['health']
  yawDeg?: number
  targetYawDeg?: number
  angularErrorDeg?: number
  lateralErrorM?: number
  frontMedianMm?: number
  leftWallMm?: number
  rightWallMm?: number
  leftOpenMm?: number
  rightOpenMm?: number
  frontBlocked?: boolean
  frontSlow?: boolean
  leftOpenFlag?: boolean
  rightOpenFlag?: boolean
  deadEnd?: boolean
  center?: number
  forward?: number
  rotation?: number
  leftMm?: number
  rightMm?: number
  backMm?: number
  forwardDistanceCm?: number
  lidarHealthy?: boolean
  navxConnected?: boolean
  validScan?: boolean
  gyroHold?: boolean
  voltageV?: number
  currentA?: number
  powerW?: number
  stateOfCharge?: number
  estimatedRuntimeMin?: number | null
  reactiveState?: string
  decision?: string
  driveControl?: string
  lastTurn?: string
  stateTimeSec?: number
  stableScans?: number
  pendingTurnDirection?: string | null
  pendingTurnArmed?: boolean | null
  turnDetected?: boolean | null
  turnExecutable?: boolean | null
}
