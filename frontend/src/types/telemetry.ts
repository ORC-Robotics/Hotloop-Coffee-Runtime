export type AlertSeverity = 'critical' | 'warning' | 'info'
export type UiTone = 'good' | 'warning' | 'critical' | 'info' | 'neutral'
export type ConnectionMode = 'team-auto' | 'manual-fallback' | 'mock-bridge'
export type ControlModeSyncStatus =
  | 'synced'
  | 'pending'
  | 'applied'
  | 'rejected'
  | 'stale'
  | 'unavailable'
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

export interface BridgeStatus {
  transport: string
  chooserPath: string
  telemetryEndpoint: string
  controlModeEndpoint: string
  connected: boolean
  lastSyncAt?: string
  message?: string
}

export type OperatorCommand = {
  type: 'set_control_mode'
  payload: { modeId: string }
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
}

export interface ControlModeFeed {
  controlMode: ControlModeState
  bridgeStatus?: BridgeStatus
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
