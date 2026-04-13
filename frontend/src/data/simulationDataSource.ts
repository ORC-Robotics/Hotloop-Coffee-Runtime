import { clamp } from '../lib/format'
import { generateMockTelemetryFrame } from './mockTelemetry'
import type {
  BridgeConnectionPreference,
  BridgeConnectionResponse,
  BridgeStatus,
  ControlModeFeed,
  ControlModeState,
  RemoteDriverAction,
  RemoteDriverFeed,
  RemoteDriverResponse,
  RemoteDriverSessionMode,
  RemoteDriverStateCommand,
  RemoteDriverStatus,
  TelemetryCatalogFeed,
  TelemetryCatalogStats,
  TelemetrySnapshot,
  TelemetryTopic,
  TelemetryTopicScope,
  TopicWriteCommand,
  TopicWriteResponse,
} from '../types/telemetry'

const TICK_MS = 150
const HEARTBEAT_TIMEOUT_MS = 650

type SimulationTuning = {
  headingBiasDeg: number
  frontDistanceBiasMm: number
  batteryBiasV: number
  commandGain: number
}

type DriveInputState = {
  x: number
  y: number
  z: number
  inputSource: string
  source: string
}

type TelemetryListener = (snapshot: TelemetrySnapshot) => void
type CatalogListener = (catalog: TelemetryCatalogFeed) => void

const simulatedModes = [
  {
    id: 'arena-a',
    label: 'Arena A',
    description: 'Primary operator route for the current simulation lane.',
    isAvailable: true,
  },
  {
    id: 'arena-b',
    label: 'Arena B',
    description: 'Secondary autonomous route for alternate field tests.',
    isAvailable: true,
  },
  {
    id: 'pit-test',
    label: 'Pit Test',
    description: 'Short validation routine for bench and pit checks.',
    isAvailable: true,
  },
] as const

function nowIso(timestampMs = Date.now()) {
  return new Date(timestampMs).toISOString()
}

function createSimulationBridgeStatus(timestamp: string): BridgeStatus {
  return {
    transport: 'simulation',
    chooserPath: 'Simulation/Auto mode',
    telemetryEndpoint: 'simulation://telemetry',
    controlModeEndpoint: 'simulation://control-mode',
    topicCatalogEndpoint: 'simulation://topics',
    topicWriteEndpoint: 'simulation://topics/write',
    remoteDriverEndpoint: 'simulation://remote-driver',
    connected: true,
    robotLinkConnected: true,
    teamNumber: 1234,
    manualHost: null,
    connectionPreference: 'team-auto',
    discoveredCameraFeeds: [],
    lastSyncAt: timestamp,
    message: 'Simulation data source active.',
  }
}

function createSimulationControlMode(timestamp: string): ControlModeState {
  return {
    availableModes: [...simulatedModes],
    currentModeId: simulatedModes[0].id,
    requestedModeId: simulatedModes[0].id,
    syncStatus: 'synced',
    lastSyncAt: timestamp,
    message: 'Simulation route ready.',
  }
}

function createSimulationRemoteDriver(): RemoteDriverStatus {
  return {
    active: false,
    mode: 'disabled',
    heartbeatFresh: false,
    heartbeatAgeSec: null,
    source: 'ORION Desktop',
    inputSource: 'idle',
    lastAction: 'none',
    driveX: 0,
    driveY: 0,
    driveZ: 0,
    gyroAssist: true,
    robotEnabled: false,
    status: 'Simulation ready. Enable teleop or auto when you want to test controls.',
  }
}

function currentModeLabel(controlMode: ControlModeState) {
  return (
    controlMode.availableModes.find((mode) => mode.id === controlMode.currentModeId)?.label ??
    controlMode.currentModeId ??
    'Arena A'
  )
}

function telemetryValueText(value: TelemetryTopic['value']) {
  if (value === null) {
    return '--'
  }

  if (Array.isArray(value)) {
    return value.map((item) => (item === null ? '--' : String(item))).join(', ')
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return '--'
    }

    if (Math.abs(value) >= 100 || Number.isInteger(value)) {
      return String(Math.round(value * 100) / 100)
    }

    return value.toFixed(Math.abs(value) >= 10 ? 1 : 2)
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false'
  }

  return value
}

function telemetryValueKind(value: TelemetryTopic['value']): TelemetryTopic['valueKind'] {
  if (Array.isArray(value)) {
    const first = value[0]
    if (typeof first === 'number') return 'number-array'
    if (typeof first === 'boolean') return 'boolean-array'
    if (typeof first === 'string') return 'string-array'
    return 'unknown'
  }

  if (typeof value === 'number') return 'number'
  if (typeof value === 'boolean') return 'boolean'
  if (typeof value === 'string') return 'string'
  return 'unknown'
}

function createTopic(
  key: string,
  label: string,
  scope: TelemetryTopicScope,
  value: TelemetryTopic['value'],
  options: {
    persistent?: boolean
    isWritable?: boolean
  } = {},
): TelemetryTopic {
  const segments = key.replace(/^\/+/, '').split('/')
  const groupPath = segments.slice(0, -1).join('/')

  return {
    key,
    label,
    scope,
    segments,
    groupPath,
    valueKind: telemetryValueKind(value),
    value,
    valueText: telemetryValueText(value),
    persistent: options.persistent ?? false,
    isWritable: options.isWritable ?? false,
  }
}

function createScopeCounts(topics: TelemetryTopic[]): Record<TelemetryTopicScope, number> {
  return topics.reduce<Record<TelemetryTopicScope, number>>(
    (counts, topic) => {
      counts[topic.scope] += 1
      return counts
    },
    {
      telemetry: 0,
      debug: 0,
      config: 0,
      'auto-mode': 0,
      other: 0,
    },
  )
}

function corridorStatus(snapshot: TelemetrySnapshot) {
  if (snapshot.perception.deadEnd) return 'DEAD_END'
  if (snapshot.perception.frontBlocked) return 'BLOCKED'
  if (snapshot.perception.leftOpenFlag && snapshot.perception.rightOpenFlag) return 'DUAL_OPENINGS'
  if (snapshot.perception.leftOpenFlag) return 'OPEN_LEFT'
  if (snapshot.perception.rightOpenFlag) return 'OPEN_RIGHT'
  return 'CLEAR_LANE'
}

class SimulationEngine {
  private tuning: SimulationTuning = {
    headingBiasDeg: 0,
    frontDistanceBiasMm: 0,
    batteryBiasV: 0,
    commandGain: 1,
  }

  private driveInput: DriveInputState = {
    x: 0,
    y: 0,
    z: 0,
    inputSource: 'idle',
    source: 'ORION Desktop',
  }

  private lastPacketTimestampMs: number | null = null
  private lastActionTimestampMs: number | null = null
  private remoteActionMessage = 'Simulation ready. Enable teleop or auto when you want to test controls.'
  private bridgeStatus = createSimulationBridgeStatus(nowIso())
  private controlMode = createSimulationControlMode(nowIso())
  private remoteDriver = createSimulationRemoteDriver()
  private snapshot = this.composeSnapshot(Date.now())
  private telemetryListeners = new Set<TelemetryListener>()
  private catalogListeners = new Set<CatalogListener>()
  private intervalId: number | null = null

  private ensureClock() {
    if (this.intervalId !== null) {
      return
    }

    this.refresh(Date.now())
    this.intervalId = window.setInterval(() => {
      this.refresh(Date.now())
      this.publish()
    }, TICK_MS)
  }

  private releaseClockIfIdle() {
    if (this.telemetryListeners.size > 0 || this.catalogListeners.size > 0) {
      return
    }

    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  private refresh(timestampMs: number) {
    const timestamp = nowIso(timestampMs)

    this.bridgeStatus = {
      ...this.bridgeStatus,
      lastSyncAt: timestamp,
      message: 'Simulation data source active.',
    }

    this.controlMode = {
      ...this.controlMode,
      lastSyncAt: timestamp,
    }

    const heartbeatAgeSec =
      this.lastPacketTimestampMs === null ? null : Math.max(0, (timestampMs - this.lastPacketTimestampMs) / 1000)
    const heartbeatFresh =
      this.remoteDriver.mode === 'teleop' &&
      this.lastPacketTimestampMs !== null &&
      timestampMs - this.lastPacketTimestampMs < HEARTBEAT_TIMEOUT_MS

    this.remoteDriver = {
      ...this.remoteDriver,
      heartbeatFresh,
      heartbeatAgeSec,
      driveX: heartbeatFresh ? this.driveInput.x : 0,
      driveY: heartbeatFresh ? this.driveInput.y : 0,
      driveZ: heartbeatFresh ? this.driveInput.z : 0,
      inputSource: heartbeatFresh ? this.driveInput.inputSource : this.remoteDriver.inputSource,
      source: this.driveInput.source,
      gyroAssist: this.remoteDriver.gyroAssist,
      status: this.resolveRemoteDriverStatus(heartbeatFresh),
      lastPacketAt: this.lastPacketTimestampMs ? nowIso(this.lastPacketTimestampMs) : undefined,
      lastActionAt: this.lastActionTimestampMs ? nowIso(this.lastActionTimestampMs) : undefined,
    }

    this.snapshot = this.composeSnapshot(timestampMs)
  }

  private resolveRemoteDriverStatus(heartbeatFresh: boolean) {
    if (this.remoteDriver.mode === 'teleop') {
      return heartbeatFresh
        ? 'Simulation teleop active and receiving live packets.'
        : 'Simulation teleop enabled. Waiting for fresh control packets.'
    }

    if (this.remoteDriver.mode === 'autonomous') {
      return `Simulation autonomous active on ${currentModeLabel(this.controlMode)}.`
    }

    return this.remoteActionMessage
  }

  private composeSnapshot(timestampMs: number) {
    const base = generateMockTelemetryFrame(timestampMs)
    const timestamp = nowIso(timestampMs)
    const targetLabel = currentModeLabel(this.controlMode)
    const routeHealth =
      this.remoteDriver.mode === 'teleop' && !this.remoteDriver.heartbeatFresh
        ? 'degraded'
        : base.connection.health

    base.timestamp = timestamp
    base.scenarioLabel = `Simulation | ${base.scenarioLabel}`
    base.connection = {
      ...base.connection,
      online: true,
      team: 1234,
      target: targetLabel,
      hostSeen: 'sim.local',
      mode: 'mock-bridge',
      routeLabel: 'Simulation stream',
      health: routeHealth,
    }
    base.bridgeStatus = this.bridgeStatus
    base.controlMode = this.controlMode

    base.heading.yawDeg = clamp(base.heading.yawDeg + this.tuning.headingBiasDeg, -180, 180)
    base.heading.targetYawDeg = clamp(base.heading.targetYawDeg + this.tuning.headingBiasDeg, -180, 180)
    base.heading.angularErrorDeg = base.heading.targetYawDeg - base.heading.yawDeg
    base.perception.frontMedianMm = clamp(base.perception.frontMedianMm + this.tuning.frontDistanceBiasMm, 160, 2400)
    base.commands.center = clamp(base.commands.center * this.tuning.commandGain, -1, 1)
    base.commands.forward = clamp(base.commands.forward * this.tuning.commandGain, -1, 1)
    base.commands.rotation = clamp(base.commands.rotation * this.tuning.commandGain, -1, 1)
    base.battery.voltageV = clamp(base.battery.voltageV + this.tuning.batteryBiasV, 10.4, 12.8)
    base.battery.stateOfCharge = clamp((base.battery.voltageV - 11.1) / 1.5, 0, 1)
    base.battery.powerW = base.battery.voltageV * base.battery.currentA

    if (this.remoteDriver.mode === 'teleop' && this.remoteDriver.heartbeatFresh) {
      base.commands.center = this.driveInput.x
      base.commands.forward = this.driveInput.y
      base.commands.rotation = this.driveInput.z
      base.heading.yawDeg = clamp(base.heading.yawDeg + this.driveInput.z * 14, -180, 180)
      base.heading.targetYawDeg = this.remoteDriver.gyroAssist ? base.heading.yawDeg : base.heading.targetYawDeg
      base.heading.angularErrorDeg = base.heading.targetYawDeg - base.heading.yawDeg
      base.encoders.leftMm += this.driveInput.y * 90 - this.driveInput.z * 28
      base.encoders.rightMm += this.driveInput.y * 90 + this.driveInput.z * 28
      base.encoders.backMm += this.driveInput.x * 58
      base.encoders.forwardDistanceCm += this.driveInput.y * 8
      base.perception.frontMedianMm = clamp(
        base.perception.frontMedianMm - this.driveInput.y * 170 + Math.abs(this.driveInput.z) * 22,
        140,
        2200,
      )
      base.perception.leftWallMm = clamp(base.perception.leftWallMm + this.driveInput.x * 70, 150, 1600)
      base.perception.rightWallMm = clamp(base.perception.rightWallMm - this.driveInput.x * 70, 150, 1600)
      base.reactive.state = 'TELEOP_SIM'
      base.reactive.decision = 'Simulation is applying live remote teleop input.'
      base.reactive.driveControl = `panel ${this.driveInput.inputSource} / gyro assist ${this.remoteDriver.gyroAssist ? 'on' : 'off'}`
      base.systems.gyroHold = this.remoteDriver.gyroAssist && Math.abs(this.driveInput.z) < 0.08
    } else if (this.remoteDriver.mode === 'autonomous') {
      base.reactive.decision = `Simulation autonomous routine following ${targetLabel}.`
    }

    return base
  }

  private buildCatalog(): TelemetryCatalogFeed {
    const topics = [
      createTopic('/robot/battery/voltage', 'Battery Voltage', 'telemetry', this.snapshot.battery.voltageV),
      createTopic('/robot/battery/percentage', 'Battery Percentage', 'telemetry', this.snapshot.battery.stateOfCharge * 100),
      createTopic('/robot/battery/current', 'Battery Current', 'telemetry', this.snapshot.battery.currentA),
      createTopic('/robot/battery/runtime_min', 'Estimated Runtime', 'telemetry', this.snapshot.battery.estimatedRuntimeMin),
      createTopic('/robot/gyro/yaw', 'Gyro Yaw', 'telemetry', this.snapshot.heading.yawDeg),
      createTopic('/robot/gyro/target_yaw', 'Target Yaw', 'telemetry', this.snapshot.heading.targetYawDeg),
      createTopic('/robot/encoders/left_distance_mm', 'Left Encoder', 'telemetry', this.snapshot.encoders.leftMm),
      createTopic('/robot/encoders/right_distance_mm', 'Right Encoder', 'telemetry', this.snapshot.encoders.rightMm),
      createTopic('/robot/encoders/back_distance_mm', 'Back Encoder', 'telemetry', this.snapshot.encoders.backMm),
      createTopic('/robot/encoders/forward_distance_cm', 'Forward Distance', 'telemetry', this.snapshot.encoders.forwardDistanceCm),
      createTopic('/robot/perception/front_distance_mm', 'Front Distance', 'telemetry', this.snapshot.perception.frontMedianMm),
      createTopic('/robot/perception/left_wall_mm', 'Left Wall', 'telemetry', this.snapshot.perception.leftWallMm),
      createTopic('/robot/perception/right_wall_mm', 'Right Wall', 'telemetry', this.snapshot.perception.rightWallMm),
      createTopic('/robot/perception/left_open_mm', 'Left Opening', 'telemetry', this.snapshot.perception.leftOpenMm),
      createTopic('/robot/perception/right_open_mm', 'Right Opening', 'telemetry', this.snapshot.perception.rightOpenMm),
      createTopic('/robot/perception/corridor_status', 'Corridor Status', 'telemetry', corridorStatus(this.snapshot)),
      createTopic('/robot/control/center', 'Center Command', 'telemetry', this.snapshot.commands.center),
      createTopic('/robot/control/forward', 'Forward Command', 'telemetry', this.snapshot.commands.forward),
      createTopic('/robot/control/rotation', 'Rotation Command', 'telemetry', this.snapshot.commands.rotation),
      createTopic('/robot/control/mode', 'Control Mode', 'config', this.remoteDriver.mode),
      createTopic('/robot/reactive/state', 'Reactive State', 'telemetry', this.snapshot.reactive.state),
      createTopic('/robot/reactive/stable_scans', 'Stable Scans', 'debug', this.snapshot.reactive.stableScans),
      createTopic('/robot/connection/status', 'Connection Status', 'debug', this.snapshot.connection.online ? 'online' : 'offline'),
      createTopic('/robot/connection/route', 'Connection Route', 'debug', this.snapshot.connection.routeLabel),
      createTopic('/robot/teleop/gyro_assist', 'Gyro Assist', 'config', this.remoteDriver.gyroAssist, {
        persistent: true,
        isWritable: true,
      }),
      createTopic('/robot/teleop/heartbeat_fresh', 'Heartbeat Fresh', 'debug', this.remoteDriver.heartbeatFresh),
      createTopic('/robot/teleop/input_source', 'Input Source', 'debug', this.remoteDriver.inputSource),
      createTopic('/robot/sim/heading_bias_deg', 'Heading Bias', 'config', this.tuning.headingBiasDeg, {
        persistent: true,
        isWritable: true,
      }),
      createTopic('/robot/sim/front_distance_bias_mm', 'Front Distance Bias', 'config', this.tuning.frontDistanceBiasMm, {
        persistent: true,
        isWritable: true,
      }),
      createTopic('/robot/sim/battery_bias_v', 'Battery Bias', 'config', this.tuning.batteryBiasV, {
        persistent: true,
        isWritable: true,
      }),
      createTopic('/robot/sim/command_gain', 'Command Gain', 'config', this.tuning.commandGain, {
        persistent: true,
        isWritable: true,
      }),
      createTopic('/robot/auto/selected_mode', 'Selected Auto Mode', 'auto-mode', currentModeLabel(this.controlMode)),
      createTopic('/robot/auto/requested_mode', 'Requested Auto Mode', 'auto-mode', this.controlMode.requestedModeId ?? '--'),
      createTopic('/robot/auto/sync_status', 'Auto Mode Sync', 'auto-mode', this.controlMode.syncStatus),
      createTopic('/robot/sim/scenario', 'Scenario', 'other', this.snapshot.scenarioId),
    ]

    const scopeCounts = createScopeCounts(topics)
    const groupCount = new Set(topics.map((topic) => topic.groupPath)).size
    const stats: TelemetryCatalogStats = {
      online: true,
      team: this.snapshot.connection.team,
      totalTopics: topics.length,
      groupCount,
      scopeCounts,
    }

    return {
      timestamp: this.snapshot.timestamp,
      topics,
      stats,
      bridgeStatus: this.bridgeStatus,
    }
  }

  private publish() {
    const snapshot = this.snapshot
    const catalog = this.buildCatalog()

    this.telemetryListeners.forEach((listener) => listener(snapshot))
    this.catalogListeners.forEach((listener) => listener(catalog))
  }

  getTelemetrySnapshot() {
    this.ensureClock()
    this.refresh(Date.now())
    return this.snapshot
  }

  subscribeTelemetry(onSnapshot: TelemetryListener) {
    this.ensureClock()
    this.telemetryListeners.add(onSnapshot)
    onSnapshot(this.getTelemetrySnapshot())

    return () => {
      this.telemetryListeners.delete(onSnapshot)
      this.releaseClockIfIdle()
    }
  }

  getTelemetryCatalog() {
    this.ensureClock()
    this.refresh(Date.now())
    return this.buildCatalog()
  }

  subscribeTelemetryCatalog(onCatalog: CatalogListener) {
    this.ensureClock()
    this.catalogListeners.add(onCatalog)
    onCatalog(this.getTelemetryCatalog())

    return () => {
      this.catalogListeners.delete(onCatalog)
      this.releaseClockIfIdle()
    }
  }

  getControlModes(): ControlModeFeed {
    this.ensureClock()
    this.refresh(Date.now())

    return {
      controlMode: this.controlMode,
      bridgeStatus: this.bridgeStatus,
    }
  }

  getBridgeConnectionStatus(): BridgeConnectionResponse {
    this.ensureClock()
    this.refresh(Date.now())

    return {
      bridgeStatus: this.bridgeStatus,
      message: 'Simulation backend is always available.',
    }
  }

  updateBridgeConnection(
    manualHost?: string | null,
    connectionPreference?: BridgeConnectionPreference,
    reconnect = true,
  ): BridgeConnectionResponse {
    this.bridgeStatus = {
      ...this.bridgeStatus,
      manualHost: manualHost?.trim() || null,
      connectionPreference:
        connectionPreference === 'manual-host' && manualHost?.trim()
          ? 'manual-host'
          : 'team-auto',
      message: reconnect
        ? 'Simulation reconnect requested.'
        : 'Simulation bridge settings updated.',
    }

    this.refresh(Date.now())
    this.publish()

    return {
      bridgeStatus: this.bridgeStatus,
      message: this.bridgeStatus.message,
    }
  }

  requestControlModeChange(modeId: string): ControlModeFeed {
    const timestamp = nowIso()
    const available = this.controlMode.availableModes.some((mode) => mode.id === modeId && mode.isAvailable)

    if (!available) {
      this.controlMode = {
        ...this.controlMode,
        syncStatus: 'rejected',
        lastCommandAt: timestamp,
        message: `Simulation mode ${modeId} is not available.`,
      }
    } else {
      this.controlMode = {
        ...this.controlMode,
        currentModeId: modeId,
        requestedModeId: modeId,
        syncStatus: 'applied',
        lastCommandAt: timestamp,
        lastSyncAt: timestamp,
        message: `Simulation route switched to ${currentModeLabel({ ...this.controlMode, currentModeId: modeId })}.`,
      }
    }

    this.refresh(Date.now())
    this.publish()

    return {
      controlMode: this.controlMode,
      bridgeStatus: this.bridgeStatus,
    }
  }

  getRemoteDriverStatus(): RemoteDriverFeed {
    this.ensureClock()
    this.refresh(Date.now())

    return {
      remoteDriver: this.remoteDriver,
      bridgeStatus: this.bridgeStatus,
    }
  }

  sendRemoteDriverState(payload: RemoteDriverStateCommand['payload']): RemoteDriverResponse {
    const now = Date.now()

    this.driveInput = {
      x: clamp(payload.x, -1, 1),
      y: clamp(payload.y, -1, 1),
      z: clamp(payload.z, -1, 1),
      inputSource: payload.inputSource,
      source: payload.source,
    }
    this.lastPacketTimestampMs = now
    this.remoteDriver = {
      ...this.remoteDriver,
      gyroAssist: payload.gyroAssist,
      source: payload.source,
      inputSource: payload.inputSource,
    }

    this.refresh(now)
    this.publish()

    return {
      remoteDriver: this.remoteDriver,
      bridgeStatus: this.bridgeStatus,
      message:
        this.remoteDriver.mode === 'teleop'
          ? 'Simulation teleop packet applied.'
          : 'Simulation input received. Start teleop to drive the robot model.',
    }
  }

  sendRemoteDriverAction(
    action: RemoteDriverAction,
    source: string,
    sessionMode?: RemoteDriverSessionMode,
  ): RemoteDriverResponse {
    const now = Date.now()
    this.lastActionTimestampMs = now

    if (action === 'start' && sessionMode === 'teleop') {
      this.remoteDriver = {
        ...this.remoteDriver,
        active: true,
        mode: 'teleop',
        robotEnabled: true,
        source,
        inputSource: 'idle',
        lastAction: 'start_teleop',
      }
      this.driveInput = {
        ...this.driveInput,
        x: 0,
        y: 0,
        z: 0,
        inputSource: 'idle',
        source,
      }
      this.lastPacketTimestampMs = now
      this.remoteActionMessage = 'Simulation teleop started. Waiting for keyboard or joystick input.'
    } else if (action === 'start' && sessionMode === 'autonomous') {
      this.remoteDriver = {
        ...this.remoteDriver,
        active: true,
        mode: 'autonomous',
        robotEnabled: true,
        source,
        inputSource: 'auto',
        lastAction: 'start_autonomous',
      }
      this.driveInput = {
        ...this.driveInput,
        x: 0,
        y: 0,
        z: 0,
        inputSource: 'idle',
        source,
      }
      this.lastPacketTimestampMs = null
      this.remoteActionMessage = `Simulation autonomous started on ${currentModeLabel(this.controlMode)}.`
    } else if (action === 'disable') {
      this.remoteDriver = {
        ...this.remoteDriver,
        active: false,
        mode: 'disabled',
        robotEnabled: false,
        lastAction: action,
      }
      this.driveInput = {
        ...this.driveInput,
        x: 0,
        y: 0,
        z: 0,
        inputSource: 'idle',
      }
      this.lastPacketTimestampMs = null
      this.remoteActionMessage = 'Simulation driver disabled.'
    } else if (action === 'reset') {
      this.driveInput = {
        ...this.driveInput,
        x: 0,
        y: 0,
        z: 0,
        inputSource: 'idle',
      }
      this.remoteDriver = {
        ...this.remoteDriver,
        lastAction: action,
      }
      this.lastPacketTimestampMs = null
      this.tuning.headingBiasDeg = 0
      this.tuning.frontDistanceBiasMm = 0
      this.remoteActionMessage = 'Simulation pose and tunables reset.'
    } else if (action === 'estop') {
      this.remoteDriver = {
        ...this.remoteDriver,
        active: false,
        mode: 'disabled',
        robotEnabled: false,
        lastAction: action,
      }
      this.driveInput = {
        ...this.driveInput,
        x: 0,
        y: 0,
        z: 0,
        inputSource: 'idle',
      }
      this.lastPacketTimestampMs = null
      this.remoteActionMessage = 'Simulation E-stop asserted.'
    } else {
      return {
        remoteDriver: this.remoteDriver,
        bridgeStatus: this.bridgeStatus,
        error: 'Simulation action requires a valid session mode.',
      }
    }

    this.refresh(now)
    this.publish()

    return {
      remoteDriver: this.remoteDriver,
      bridgeStatus: this.bridgeStatus,
      message: this.remoteActionMessage,
    }
  }

  writeTelemetryTopicValue(
    key: string,
    valueKind: TopicWriteCommand['payload']['valueKind'],
    value: TopicWriteCommand['payload']['value'],
  ): TopicWriteResponse {
    if (key === '/robot/teleop/gyro_assist' && valueKind === 'boolean' && typeof value === 'boolean') {
      this.remoteDriver = {
        ...this.remoteDriver,
        gyroAssist: value,
      }
    } else if (key === '/robot/sim/heading_bias_deg' && valueKind === 'number' && typeof value === 'number') {
      this.tuning.headingBiasDeg = clamp(value, -45, 45)
    } else if (key === '/robot/sim/front_distance_bias_mm' && valueKind === 'number' && typeof value === 'number') {
      this.tuning.frontDistanceBiasMm = clamp(value, -900, 900)
    } else if (key === '/robot/sim/battery_bias_v' && valueKind === 'number' && typeof value === 'number') {
      this.tuning.batteryBiasV = clamp(value, -1.5, 1.5)
    } else if (key === '/robot/sim/command_gain' && valueKind === 'number' && typeof value === 'number') {
      this.tuning.commandGain = clamp(value, 0.2, 1.8)
    } else {
      return {
        error: 'Topic is not writable in simulation mode.',
        bridgeStatus: this.bridgeStatus,
      }
    }

    this.refresh(Date.now())
    this.publish()

    const topic = this.buildCatalog().topics.find((item) => item.key === key)

    return {
      topic,
      message: 'Simulation topic updated.',
      bridgeStatus: this.bridgeStatus,
    }
  }
}

const engine = new SimulationEngine()

export async function getTelemetrySnapshot(): Promise<TelemetrySnapshot> {
  return engine.getTelemetrySnapshot()
}

export function subscribeTelemetry(
  onSnapshot: (snapshot: TelemetrySnapshot) => void,
  _onError: () => void,
  _intervalMs: number,
) {
  void _onError
  void _intervalMs
  return engine.subscribeTelemetry(onSnapshot)
}

export async function getTelemetryCatalog(): Promise<TelemetryCatalogFeed> {
  return engine.getTelemetryCatalog()
}

export function subscribeTelemetryCatalog(
  onCatalog: (catalog: TelemetryCatalogFeed) => void,
  _onError: () => void,
  _intervalMs: number,
) {
  void _onError
  void _intervalMs
  return engine.subscribeTelemetryCatalog(onCatalog)
}

export async function getControlModes(): Promise<ControlModeFeed> {
  return engine.getControlModes()
}

export async function getBridgeConnectionStatus(): Promise<BridgeConnectionResponse> {
  return engine.getBridgeConnectionStatus()
}

export async function updateBridgeConnection(
  manualHost?: string | null,
  connectionPreference?: BridgeConnectionPreference,
  reconnect = true,
): Promise<BridgeConnectionResponse> {
  return engine.updateBridgeConnection(manualHost, connectionPreference, reconnect)
}

export async function requestControlModeChange(modeId: string): Promise<ControlModeFeed> {
  return engine.requestControlModeChange(modeId)
}

export async function getRemoteDriverStatus(): Promise<RemoteDriverFeed> {
  return engine.getRemoteDriverStatus()
}

export async function sendRemoteDriverState(
  payload: RemoteDriverStateCommand['payload'],
): Promise<RemoteDriverResponse> {
  return engine.sendRemoteDriverState(payload)
}

export async function sendRemoteDriverAction(
  action: RemoteDriverAction,
  source: string,
  sessionMode?: RemoteDriverSessionMode,
): Promise<RemoteDriverResponse> {
  return engine.sendRemoteDriverAction(action, source, sessionMode)
}

export async function writeTelemetryTopicValue(
  key: string,
  valueKind: TopicWriteCommand['payload']['valueKind'],
  value: TopicWriteCommand['payload']['value'],
): Promise<TopicWriteResponse> {
  return engine.writeTelemetryTopicValue(key, valueKind, value)
}
