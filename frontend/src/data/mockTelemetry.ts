import type {
  ConnectionStatus,
  MockScenarioId,
  PlanarPoseData,
  PlanarPoseFreshness,
  PlanarPoseSource,
  SpatialLidarFormat,
  SpatialLidarScan,
  SpatialLidarSource,
  SpatialSnapshot,
  SpatialStreamStatus,
  TelemetrySnapshot,
  TelemetryPoseSources,
} from '../types/telemetry'
import { clamp } from '../lib/format'

interface ScenarioFrame {
  id: MockScenarioId
  label: string
  durationMs: number
}

const SCENARIOS: ScenarioFrame[] = [
  { id: 'corridor-cruise', label: 'Corridor cruise', durationMs: 10_000 },
  { id: 'front-obstacle', label: 'Approaching frontal obstacle', durationMs: 9_000 },
  { id: 'left-opening', label: 'Opening available on the left', durationMs: 8_000 },
  { id: 'right-opening', label: 'Opening available on the right', durationMs: 8_000 },
  { id: 'dead-end', label: 'Dead-end recovery', durationMs: 9_000 },
  { id: 'scan-instability', label: 'Temporary scan instability', durationMs: 7_000 },
]

const BATTERY_USABLE_CAPACITY_AH = 10.5
const BATTERY_ESTIMATE_FULL_V = 12.6
const BATTERY_ESTIMATE_EMPTY_V = 11.1
const BATTERY_IDLE_DRAW_FLOOR_A = 8
const BATTERY_ACTIVE_DRAW_FLOOR_A = 22

export function createPlanarPoseData(
  source: PlanarPoseSource,
  overrides: Partial<PlanarPoseData> = {},
): PlanarPoseData {
  const defaultFrame =
    source === 'odometry'
      ? 'odometry_local'
      : source === 'reactive'
        ? 'reactive_local'
        : source === 'mapeamento'
          ? 'mapeamento_local'
          : source === 'simulation'
            ? 'simulation_local'
            : 'none'

  return {
    available: source !== 'none',
    source,
    xMm: 0,
    yMm: 0,
    yawDeg: 0,
    timestampMs: 0,
    sequence: 0,
    freshness: (source === 'none' ? 'invalid' : 'stale') satisfies PlanarPoseFreshness,
    frame: defaultFrame,
    ...overrides,
  }
}

export function createDefaultPoseSources(): TelemetryPoseSources {
  return {
    odometry: createPlanarPoseData('odometry', { available: false, freshness: 'invalid' }),
    reactive: createPlanarPoseData('reactive', { available: false, freshness: 'invalid' }),
    mapeamento: createPlanarPoseData('mapeamento', { available: false, freshness: 'invalid' }),
    simulation: createPlanarPoseData('simulation', { available: false, freshness: 'invalid' }),
  }
}

export function createSpatialLidarScan(
  source: SpatialLidarSource,
  overrides: Partial<SpatialLidarScan> = {},
): SpatialLidarScan {
  const format =
    source === 'robot' || source === 'simulation'
      ? ('polar-2d-v1' satisfies SpatialLidarFormat)
      : ('none' satisfies SpatialLidarFormat)

  return {
    available: source !== 'none',
    source,
    freshness: (source === 'none' ? 'invalid' : 'stale') satisfies PlanarPoseFreshness,
    format,
    frame: source === 'none' ? 'none' : 'robot_base',
    poseFrame: source === 'simulation' ? 'simulation_local' : source === 'robot' ? 'odometry_local' : 'none',
    angleStartDeg: 120,
    angleStepDeg: 4,
    distancesMm: [],
    pointCount: 0,
    validPointCount: 0,
    sequence: 0,
    timestampMs: 0,
    ...overrides,
  }
}

export function createSpatialStreamStatus(
  transport: SpatialStreamStatus['transport'],
  overrides: Partial<SpatialStreamStatus> = {},
): SpatialStreamStatus {
  return {
    transport,
    endpoint: transport === 'simulation' ? 'simulation://spatial' : '/api/spatial',
    message:
      transport === 'simulation'
        ? 'Simulation spatial feed active.'
        : 'Dedicated spatial feed unavailable.',
    ...overrides,
  }
}

function estimateBatteryRuntimeMinutes(voltageV: number, currentA: number, robotEnabled: boolean) {
  if (voltageV <= 0) {
    return { stateOfCharge: 0, estimatedRuntimeMin: null as number | null }
  }

  const voltageSpan = BATTERY_ESTIMATE_FULL_V - BATTERY_ESTIMATE_EMPTY_V
  const stateOfCharge = clamp((voltageV - BATTERY_ESTIMATE_EMPTY_V) / voltageSpan, 0, 1)

  if (currentA <= 0.25 || stateOfCharge <= 0) {
    return { stateOfCharge, estimatedRuntimeMin: null as number | null }
  }

  const effectiveCurrent = Math.max(
    currentA,
    robotEnabled ? BATTERY_ACTIVE_DRAW_FLOOR_A : BATTERY_IDLE_DRAW_FLOOR_A,
  )

  return {
    stateOfCharge,
    estimatedRuntimeMin: Math.max(0, (stateOfCharge * BATTERY_USABLE_CAPACITY_AH / effectiveCurrent) * 60),
  }
}

export function createBaseSnapshot(): TelemetrySnapshot {
  return {
    timestamp: new Date().toISOString(),
    scenarioId: 'corridor-cruise',
    scenarioLabel: 'Corridor cruise',
    pose: createPlanarPoseData('none', { available: false, freshness: 'invalid' }),
    poseSources: createDefaultPoseSources(),
    connection: {
      online: true,
      team: 1234,
      target: 'team 1234',
      hostSeen: '10.12.34.2',
      mode: 'mock-bridge',
      routeLabel: 'Mock bridge',
      health: 'stable',
    },
    heading: {
      yawDeg: 0,
      targetYawDeg: 0,
      angularErrorDeg: 0,
      lateralErrorM: 0,
    },
    perception: {
      frontMedianMm: 1400,
      leftWallMm: 620,
      rightWallMm: 610,
      leftOpenMm: 180,
      rightOpenMm: 160,
      frontBlocked: false,
      frontSlow: false,
      leftOpenFlag: false,
      rightOpenFlag: false,
      deadEnd: false,
    },
    commands: {
      center: 0,
      forward: 0.62,
      rotation: 0.02,
    },
    encoders: {
      leftMm: 2140,
      rightMm: 2128,
      backMm: 15,
      forwardDistanceCm: 214,
    },
    systems: {
      lidarHealthy: true,
      navxConnected: true,
      validScan: true,
      gyroHold: false,
    },
    battery: {
      voltageV: 12.6,
      currentA: 18,
      powerW: 226.8,
      stateOfCharge: 0.92,
      estimatedRuntimeMin: 55,
    },
    reactive: {
      state: 'CRUISE_CENTER',
      decision: 'Maintain corridor centerline and continue advancing.',
      driveControl: 'Closed-loop centering with moderate forward bias.',
      lastTurn: 'none',
      stateTimeSec: 2.4,
      stableScans: 7,
      pendingTurnDirection: 'NONE',
      pendingTurnArmed: false,
      turnDetected: false,
      turnExecutable: false,
    },
  }
}

export function createOfflineSnapshot(): TelemetrySnapshot {
  return {
    timestamp: new Date().toISOString(),
    scenarioId: 'corridor-cruise',
    scenarioLabel: 'live standby',
    pose: createPlanarPoseData('none', { available: false, freshness: 'invalid' }),
    poseSources: createDefaultPoseSources(),
    connection: {
      online: false,
      team: 1234,
      target: 'team 1234',
      hostSeen: '--',
      mode: 'team-auto',
      routeLabel: 'Awaiting robot link',
      health: 'unstable',
    },
    heading: {
      yawDeg: 0,
      targetYawDeg: 0,
      angularErrorDeg: 0,
      lateralErrorM: 0,
    },
    perception: {
      frontMedianMm: 0,
      leftWallMm: 0,
      rightWallMm: 0,
      leftOpenMm: 0,
      rightOpenMm: 0,
      frontBlocked: false,
      frontSlow: false,
      leftOpenFlag: false,
      rightOpenFlag: false,
      deadEnd: false,
    },
    commands: {
      center: 0,
      forward: 0,
      rotation: 0,
    },
    encoders: {
      leftMm: 0,
      rightMm: 0,
      backMm: 0,
      forwardDistanceCm: 0,
    },
    systems: {
      lidarHealthy: false,
      navxConnected: false,
      validScan: false,
      gyroHold: false,
    },
    battery: {
      voltageV: 0,
      currentA: 0,
      powerW: 0,
      stateOfCharge: 0,
      estimatedRuntimeMin: null,
    },
    reactive: {
      state: 'OFFLINE',
      decision: 'Waiting for live telemetry from the robot bridge.',
      driveControl: 'No drive command stream available.',
      lastTurn: 'none',
      stateTimeSec: 0,
      stableScans: 0,
      pendingTurnDirection: null,
      pendingTurnArmed: null,
      turnDetected: null,
      turnExecutable: null,
    },
  }
}

export function createBaseSpatialSnapshot(): SpatialSnapshot {
  const base = createBaseSnapshot()

  return {
    timestamp: base.timestamp,
    bridgeStatus: base.bridgeStatus,
    connection: base.connection,
    pose: base.pose,
    poseSources: base.poseSources,
    lidar: createSpatialLidarScan('none', { available: false, freshness: 'invalid' }),
    stream: createSpatialStreamStatus('bridge-http-poll'),
  }
}

export function createOfflineSpatialSnapshot(): SpatialSnapshot {
  const base = createOfflineSnapshot()

  return {
    timestamp: base.timestamp,
    bridgeStatus: base.bridgeStatus,
    connection: base.connection,
    pose: base.pose,
    poseSources: base.poseSources,
    lidar: createSpatialLidarScan('none', { available: false, freshness: 'invalid' }),
    stream: createSpatialStreamStatus('bridge-http-poll', {
      message: 'Dedicated spatial feed waiting for the robot link.',
    }),
  }
}

function scenarioAt(timeMs: number) {
  const cycleDuration = SCENARIOS.reduce((total, scenario) => total + scenario.durationMs, 0)
  const cyclePosition = ((timeMs % cycleDuration) + cycleDuration) % cycleDuration

  let cursor = 0
  for (const scenario of SCENARIOS) {
    if (cyclePosition < cursor + scenario.durationMs) {
      return {
        scenario,
        progress: (cyclePosition - cursor) / scenario.durationMs,
      }
    }
    cursor += scenario.durationMs
  }

  return {
    scenario: SCENARIOS[0],
    progress: 0,
  }
}

function withConnection(
  base: TelemetrySnapshot,
  partial: Partial<ConnectionStatus>,
): TelemetrySnapshot {
  return {
    ...base,
    connection: {
      ...base.connection,
      ...partial,
    },
  }
}

export function generateMockTelemetryFrame(timeMs: number): TelemetrySnapshot {
  const { scenario, progress } = scenarioAt(timeMs)
  const wave = Math.sin(timeMs / 1100)
  const fineWave = Math.sin(timeMs / 530)
  const base = createBaseSnapshot()
  base.timestamp = new Date(timeMs).toISOString()
  base.scenarioId = scenario.id
  base.scenarioLabel = scenario.label

  switch (scenario.id) {
    case 'corridor-cruise': {
      base.heading.yawDeg = wave * 3.2
      base.heading.targetYawDeg = 0
      base.heading.angularErrorDeg = base.heading.targetYawDeg - base.heading.yawDeg
      base.heading.lateralErrorM = fineWave * 0.04
      base.perception.frontMedianMm = 1480 + wave * 60
      base.perception.leftWallMm = 625 + fineWave * 16
      base.perception.rightWallMm = 612 - fineWave * 14
      base.perception.leftOpenMm = 180 + wave * 22
      base.perception.rightOpenMm = 170 - wave * 18
      base.commands.center = base.heading.lateralErrorM * -2.8
      base.commands.forward = 0.66
      base.commands.rotation = base.heading.angularErrorDeg / 26
      base.encoders.leftMm = 2140 + progress * 280
      base.encoders.rightMm = 2128 + progress * 276
      base.encoders.forwardDistanceCm = 214 + progress * 28
      base.reactive.state = 'CRUISE_CENTER'
      base.reactive.decision = 'Maintain corridor centerline and preserve steady forward progress.'
      base.reactive.driveControl = 'Centering loop with forward gain enabled.'
      base.reactive.lastTurn = 'none'
      base.reactive.stateTimeSec = 1.8 + progress * 4
      base.reactive.stableScans = 7
      base.reactive.pendingTurnDirection = 'NONE'
      base.reactive.pendingTurnArmed = false
      base.reactive.turnDetected = false
      base.reactive.turnExecutable = false
      base.battery.voltageV = 12.5 + wave * 0.05
      base.battery.currentA = 16 + Math.abs(fineWave) * 5
      break
    }
    case 'front-obstacle': {
      const front = 920 - progress * 680
      base.heading.yawDeg = wave * 5
      base.heading.targetYawDeg = 0
      base.heading.angularErrorDeg = -base.heading.yawDeg
      base.heading.lateralErrorM = 0.06 + fineWave * 0.03
      base.perception.frontMedianMm = front
      base.perception.leftWallMm = 590 + wave * 18
      base.perception.rightWallMm = 570 - wave * 16
      base.perception.leftOpenMm = 240 + progress * 110
      base.perception.rightOpenMm = 180 + progress * 40
      base.perception.frontSlow = front < 650
      base.perception.frontBlocked = front < 330
      base.commands.center = -0.22
      base.commands.forward = clamp(0.62 - progress * 0.55, 0.08, 0.62)
      base.commands.rotation = 0.14 + progress * 0.18
      base.encoders.leftMm = 2460 + progress * 110
      base.encoders.rightMm = 2442 + progress * 94
      base.encoders.forwardDistanceCm = 246 + progress * 11
      base.reactive.state = base.perception.frontBlocked ? 'FRONT_BLOCKED' : 'FRONT_APPROACH'
      base.reactive.decision = base.perception.frontBlocked
        ? 'Stop advance and bias away from the frontal obstacle.'
        : 'Reduce forward command while evaluating escape corridor.'
      base.reactive.driveControl = 'Forward command taper with increasing rotational authority.'
      base.reactive.lastTurn = 'left-bias'
      base.reactive.stateTimeSec = 0.8 + progress * 4.4
      base.reactive.stableScans = front < 330 ? 3 : 5
      base.reactive.pendingTurnDirection = progress > 0.58 ? 'LEFT' : 'NONE'
      base.reactive.pendingTurnArmed = progress > 0.58
      base.reactive.turnDetected = progress > 0.34
      base.reactive.turnExecutable = progress > 0.46 && !base.perception.frontBlocked
      base.battery.voltageV = 12.1 - progress * 0.35
      base.battery.currentA = 28 + progress * 10
      break
    }
    case 'left-opening': {
      base.heading.yawDeg = -8 + wave * 2
      base.heading.targetYawDeg = -24
      base.heading.angularErrorDeg = base.heading.targetYawDeg - base.heading.yawDeg
      base.heading.lateralErrorM = -0.12 + fineWave * 0.02
      base.perception.frontMedianMm = 640 + wave * 55
      base.perception.leftWallMm = 410 + wave * 16
      base.perception.rightWallMm = 720 - wave * 10
      base.perception.leftOpenMm = 1520 + progress * 280
      base.perception.rightOpenMm = 180 + fineWave * 24
      base.perception.leftOpenFlag = true
      base.perception.frontSlow = true
      base.commands.center = -0.38
      base.commands.forward = 0.28
      base.commands.rotation = -0.56
      base.encoders.leftMm = 2610 + progress * 76
      base.encoders.rightMm = 2580 + progress * 121
      base.encoders.backMm = -38 - progress * 24
      base.encoders.forwardDistanceCm = 262 + progress * 7
      base.reactive.state = 'OPEN_LEFT_DECISION'
      base.reactive.decision = 'Opening to the left is viable. Commit to left turn entry.'
      base.reactive.driveControl = 'Left-turn command with reduced forward speed.'
      base.reactive.lastTurn = 'left'
      base.reactive.stateTimeSec = 1.2 + progress * 3.8
      base.reactive.stableScans = 6
      base.reactive.pendingTurnDirection = 'LEFT'
      base.reactive.pendingTurnArmed = true
      base.reactive.turnDetected = true
      base.reactive.turnExecutable = true
      base.battery.voltageV = 11.9 + wave * 0.04
      base.battery.currentA = 32 + Math.abs(fineWave) * 8
      break
    }
    case 'right-opening': {
      base.heading.yawDeg = 7 - wave * 2.5
      base.heading.targetYawDeg = 21
      base.heading.angularErrorDeg = base.heading.targetYawDeg - base.heading.yawDeg
      base.heading.lateralErrorM = 0.11 + fineWave * 0.02
      base.perception.frontMedianMm = 690 + wave * 48
      base.perception.leftWallMm = 730 + wave * 14
      base.perception.rightWallMm = 430 - wave * 16
      base.perception.leftOpenMm = 170 + fineWave * 22
      base.perception.rightOpenMm = 1480 + progress * 260
      base.perception.rightOpenFlag = true
      base.perception.frontSlow = true
      base.commands.center = 0.36
      base.commands.forward = 0.31
      base.commands.rotation = 0.54
      base.encoders.leftMm = 2770 + progress * 126
      base.encoders.rightMm = 2754 + progress * 81
      base.encoders.backMm = 42 + progress * 20
      base.encoders.forwardDistanceCm = 278 + progress * 8
      base.reactive.state = 'OPEN_RIGHT_DECISION'
      base.reactive.decision = 'Right-side opening is dominant. Initiate right entry manoeuvre.'
      base.reactive.driveControl = 'Right-turn command with controlled forward pulse.'
      base.reactive.lastTurn = 'right'
      base.reactive.stateTimeSec = 1 + progress * 4
      base.reactive.stableScans = 6
      base.reactive.pendingTurnDirection = 'RIGHT'
      base.reactive.pendingTurnArmed = true
      base.reactive.turnDetected = true
      base.reactive.turnExecutable = true
      base.battery.voltageV = 11.95 + wave * 0.05
      base.battery.currentA = 31 + Math.abs(fineWave) * 7
      break
    }
    case 'dead-end': {
      base.heading.yawDeg = 26 + wave * 4
      base.heading.targetYawDeg = 94
      base.heading.angularErrorDeg = base.heading.targetYawDeg - base.heading.yawDeg
      base.heading.lateralErrorM = 0.18 + fineWave * 0.04
      base.perception.frontMedianMm = 220 + wave * 18
      base.perception.leftWallMm = 295 + wave * 12
      base.perception.rightWallMm = 310 - wave * 12
      base.perception.leftOpenMm = 110 + fineWave * 12
      base.perception.rightOpenMm = 122 - fineWave * 10
      base.perception.frontBlocked = true
      base.perception.frontSlow = true
      base.perception.deadEnd = true
      base.commands.center = 0.04
      base.commands.forward = 0.04
      base.commands.rotation = 0.78
      base.encoders.leftMm = 2910 + progress * 24
      base.encoders.rightMm = 2895 - progress * 18
      base.encoders.backMm = 86 + progress * 36
      base.encoders.forwardDistanceCm = 291 + progress * 2
      base.reactive.state = 'DEAD_END_RECOVERY'
      base.reactive.decision = 'Dead end confirmed. Pivot in place to reacquire a free corridor.'
      base.reactive.driveControl = 'Rotation-dominant recovery with forward hold.'
      base.reactive.lastTurn = 'right'
      base.reactive.stateTimeSec = 0.6 + progress * 5.4
      base.reactive.stableScans = 2
      base.systems.gyroHold = true
      base.reactive.pendingTurnDirection = 'NONE'
      base.reactive.pendingTurnArmed = false
      base.reactive.turnDetected = false
      base.reactive.turnExecutable = false
      base.battery.voltageV = 11.4 + wave * 0.06
      base.battery.currentA = 38 + progress * 14
      break
    }
    case 'scan-instability': {
      const offlineWindow = progress > 0.68 && progress < 0.84
      const validScan = progress < 0.24 || progress > 0.46
      base.connection = withConnection(base, {
        online: !offlineWindow,
        health: offlineWindow ? 'unstable' : 'degraded',
        hostSeen: offlineWindow ? 'searching...' : '10.12.34.11',
        target: '10.12.34.11',
        mode: 'manual-fallback',
        routeLabel: 'Fallback IP route',
      }).connection
      base.heading.yawDeg = wave * 9
      base.heading.targetYawDeg = 0
      base.heading.angularErrorDeg = -base.heading.yawDeg
      base.heading.lateralErrorM = fineWave * 0.15
      base.perception.frontMedianMm = 840 + wave * 140
      base.perception.leftWallMm = 560 + fineWave * 42
      base.perception.rightWallMm = 590 - fineWave * 46
      base.perception.leftOpenMm = 210 + wave * 55
      base.perception.rightOpenMm = 230 - wave * 48
      base.commands.center = fineWave * 0.22
      base.commands.forward = 0.22
      base.commands.rotation = wave * 0.28
      base.encoders.leftMm = 2960 + progress * 46
      base.encoders.rightMm = 2946 + progress * 44
      base.encoders.forwardDistanceCm = 296 + progress * 4
      base.reactive.state = validScan ? 'SCAN_RECOVERY' : 'SCAN_UNSTABLE'
      base.reactive.decision = validScan
        ? 'Scan recovered. Resume cautious corridor tracking.'
        : 'Scan confidence dropped. Hold conservative commands until perception stabilizes.'
      base.reactive.driveControl = 'Conservative forward command with reduced trust in lateral updates.'
      base.reactive.lastTurn = 'none'
      base.reactive.stateTimeSec = 0.7 + progress * 4.1
      base.reactive.stableScans = validScan ? 4 : 1
      base.systems.validScan = validScan
      base.reactive.pendingTurnDirection = validScan ? 'NONE' : null
      base.reactive.pendingTurnArmed = validScan ? false : null
      base.reactive.turnDetected = validScan ? false : null
      base.reactive.turnExecutable = validScan ? false : null
      base.battery.voltageV = offlineWindow ? 11.2 : 11.8 + wave * 0.07
      base.battery.currentA = offlineWindow ? 0 : 24 + Math.abs(fineWave) * 9
      break
    }
  }

  base.battery.powerW = base.battery.voltageV * base.battery.currentA
  const batteryEstimate = estimateBatteryRuntimeMinutes(
    base.battery.voltageV,
    base.battery.currentA,
    base.connection.online,
  )
  base.battery.stateOfCharge = batteryEstimate.stateOfCharge
  base.battery.estimatedRuntimeMin = batteryEstimate.estimatedRuntimeMin

  return base
}
