import type {
  BridgeConnectionPreference,
  BridgeStatus,
  ControlModeFeed,
  ControlModeState,
  PlanarPoseData,
  PlanarPoseSource,
  RawRemoteDriverPayload,
  RawBackendTelemetry,
  RawSpatialPayload,
  RawTelemetryCatalogPayload,
  RawNetworkTablesPayload,
  RemoteDriverFeed,
  RemoteDriverStatus,
  SpatialLidarScan,
  SpatialSnapshot,
  SpatialStreamStatus,
  TelemetryCatalogFeed,
  TelemetryCatalogStats,
  TelemetrySnapshot,
  TelemetryTopic,
  TelemetryTopicScope,
} from '../types/telemetry'
import {
  createBaseSnapshot,
  createBaseSpatialSnapshot,
  createDefaultPoseSources,
  createPlanarPoseData,
  createSpatialLidarScan,
  createSpatialStreamStatus,
} from './mockTelemetry'

function createFallbackControlMode(): ControlModeState {
  return {
    availableModes: [],
    currentModeId: null,
    requestedModeId: null,
    syncStatus: 'unavailable',
    message: 'Control mode state unavailable.',
  }
}

function createFallbackBridgeStatus(): BridgeStatus {
  return {
    transport: 'networktables',
    chooserPath: 'SmartDashboard/Auto mode',
    telemetryEndpoint: '/api/telemetry',
    spatialEndpoint: '/api/spatial',
    controlModeEndpoint: '/api/control-mode',
    topicCatalogEndpoint: '/api/topics',
    topicWriteEndpoint: '/api/topics/write',
    remoteDriverEndpoint: '/api/remote-driver',
    connected: false,
    robotLinkConnected: false,
    teamNumber: 0,
    manualHost: null,
    connectionPreference: 'team-auto' satisfies BridgeConnectionPreference,
    discoveredCameraFeeds: [],
    message: 'Bridge status unavailable.',
  }
}

function createFallbackScopeCounts(): Record<TelemetryTopicScope, number> {
  return {
    telemetry: 0,
    debug: 0,
    config: 0,
    'auto-mode': 0,
    other: 0,
  }
}

function createFallbackCatalogStats(): TelemetryCatalogStats {
  return {
    online: false,
    team: 0,
    totalTopics: 0,
    groupCount: 0,
    scopeCounts: createFallbackScopeCounts(),
  }
}

function createFallbackRemoteDriver(): RemoteDriverStatus {
  return {
    active: false,
    mode: 'disabled',
    heartbeatFresh: false,
    heartbeatAgeSec: null,
    source: 'ORION',
    inputSource: 'idle',
    lastAction: 'none',
    driveX: 0,
    driveY: 0,
    driveZ: 0,
    gyroAssist: true,
    robotEnabled: false,
    status: 'Remote driver unavailable.',
  }
}

function createFallbackPose(source: PlanarPoseSource): PlanarPoseData {
  return createPlanarPoseData(source, {
    available: false,
    freshness: 'invalid',
  })
}

function normalizePoseData(
  source: PlanarPoseSource,
  payload?: Partial<PlanarPoseData>,
): PlanarPoseData {
  return {
    ...createFallbackPose(source),
    ...(payload ?? {}),
    source,
  }
}

function normalizeAutoPose(payload?: Partial<PlanarPoseData>): PlanarPoseData {
  const source = payload?.source ?? 'none'
  return {
    ...createPlanarPoseData(source, {
      available: false,
      freshness: 'invalid',
    }),
    ...(payload ?? {}),
    source,
  }
}

function normalizePoseSources(payload?: RawBackendTelemetry['poseSources']) {
  const defaults = createDefaultPoseSources()

  return {
    odometry: normalizePoseData('odometry', payload?.odometry ?? defaults.odometry),
    reactive: normalizePoseData('reactive', payload?.reactive ?? defaults.reactive),
    mapeamento: normalizePoseData('mapeamento', payload?.mapeamento ?? defaults.mapeamento),
    simulation: normalizePoseData('simulation', payload?.simulation ?? defaults.simulation),
  }
}

function normalizeSpatialLidar(payload?: Partial<SpatialLidarScan>): SpatialLidarScan {
  const source = payload?.source ?? 'none'
  const base = createSpatialLidarScan(source, {
    available: false,
    freshness: 'invalid',
  })
  const rawDistances = Array.isArray(payload?.distancesMm) ? payload?.distancesMm : base.distancesMm
  const distancesMm = rawDistances.map((distance) =>
    Number.isFinite(Number(distance)) ? Number(distance) : 0,
  )

  return {
    ...base,
    ...(payload ?? {}),
    source,
    distancesMm,
    pointCount: payload?.pointCount ?? distancesMm.length,
    validPointCount:
      payload?.validPointCount ?? distancesMm.filter((distanceMm) => distanceMm > 0).length,
  }
}

function normalizeSpatialStream(payload?: Partial<SpatialStreamStatus>): SpatialStreamStatus {
  const transport = payload?.transport ?? 'bridge-http-poll'

  return {
    ...createSpatialStreamStatus(transport),
    ...(payload ?? {}),
    transport,
  }
}

export function adaptBackendTelemetry(payload: RawBackendTelemetry): TelemetrySnapshot {
  const base = createBaseSnapshot()

  return {
    ...base,
    timestamp: payload.timestamp ?? base.timestamp,
    scenarioLabel: payload.scenarioLabel ?? base.scenarioLabel,
    pose: normalizeAutoPose(payload.pose),
    poseSources: normalizePoseSources(payload.poseSources),
    bridgeStatus: payload.bridgeStatus
      ? { ...createFallbackBridgeStatus(), ...payload.bridgeStatus }
      : createFallbackBridgeStatus(),
    controlMode: payload.controlMode
      ? {
          ...createFallbackControlMode(),
          ...payload.controlMode,
          availableModes: payload.controlMode.availableModes ?? [],
        }
      : createFallbackControlMode(),
    connection: { ...base.connection, ...payload.connection },
    heading: { ...base.heading, ...payload.heading },
    perception: { ...base.perception, ...payload.perception },
    commands: { ...base.commands, ...payload.commands },
    encoders: { ...base.encoders, ...payload.encoders },
    systems: { ...base.systems, ...payload.systems },
    battery: { ...base.battery, ...payload.battery },
    reactive: { ...base.reactive, ...payload.reactive },
  }
}

export function adaptSpatialPayload(payload: RawSpatialPayload): SpatialSnapshot {
  const base = createBaseSpatialSnapshot()

  return {
    ...base,
    timestamp: payload.timestamp ?? base.timestamp,
    pose: normalizeAutoPose(payload.pose),
    poseSources: normalizePoseSources(payload.poseSources),
    bridgeStatus: payload.bridgeStatus
      ? { ...createFallbackBridgeStatus(), ...payload.bridgeStatus }
      : createFallbackBridgeStatus(),
    connection: { ...base.connection, ...payload.connection },
    lidar: normalizeSpatialLidar(payload.lidar),
    stream: normalizeSpatialStream(payload.stream),
  }
}

export function adaptControlModePayload(payload: {
  controlMode?: Partial<ControlModeState>
  bridgeStatus?: Partial<BridgeStatus>
}): ControlModeFeed {
  return {
    controlMode: payload.controlMode
      ? {
          ...createFallbackControlMode(),
          ...payload.controlMode,
          availableModes: payload.controlMode.availableModes ?? [],
        }
      : createFallbackControlMode(),
    bridgeStatus: payload.bridgeStatus
      ? { ...createFallbackBridgeStatus(), ...payload.bridgeStatus }
      : createFallbackBridgeStatus(),
  }
}

export function adaptRemoteDriverPayload(payload: RawRemoteDriverPayload): RemoteDriverFeed {
  return {
    remoteDriver: payload.remoteDriver
      ? {
          ...createFallbackRemoteDriver(),
          ...payload.remoteDriver,
        }
      : createFallbackRemoteDriver(),
    bridgeStatus: payload.bridgeStatus
      ? { ...createFallbackBridgeStatus(), ...payload.bridgeStatus }
      : createFallbackBridgeStatus(),
  }
}

function normalizeTopic(topic: Partial<TelemetryTopic>): TelemetryTopic | null {
  if (!topic.key) {
    return null
  }

  const keySegments = topic.key.split('/').filter(Boolean)
  const fallbackLabel = keySegments[keySegments.length - 1] ?? topic.key

  return {
    key: topic.key,
    label: topic.label ?? fallbackLabel,
    scope: topic.scope ?? 'other',
    segments: topic.segments ?? keySegments,
    groupPath: topic.groupPath ?? keySegments.slice(0, -1).join('/'),
    valueKind: topic.valueKind ?? 'unknown',
    value: topic.value ?? null,
    valueText: topic.valueText ?? 'unavailable',
    persistent: topic.persistent ?? false,
    isWritable: topic.isWritable ?? false,
  }
}

export function adaptTelemetryCatalogPayload(payload: RawTelemetryCatalogPayload): TelemetryCatalogFeed {
  const stats = createFallbackCatalogStats()

  return {
    timestamp: payload.timestamp ?? new Date().toISOString(),
    topics: (payload.topics ?? [])
      .map((topic) => normalizeTopic(topic))
      .filter((topic): topic is TelemetryTopic => topic !== null),
    stats: payload.stats
      ? {
          ...stats,
          ...payload.stats,
          scopeCounts: {
            ...stats.scopeCounts,
            ...(payload.stats.scopeCounts ?? {}),
          },
        }
      : stats,
    bridgeStatus: payload.bridgeStatus
      ? { ...createFallbackBridgeStatus(), ...payload.bridgeStatus }
      : createFallbackBridgeStatus(),
  }
}

export function adaptNetworkTablesPayload(payload: RawNetworkTablesPayload): TelemetrySnapshot {
  return adaptBackendTelemetry({
    connection: {
      team: payload.team,
      mode: payload.mode,
      target: payload.target,
      hostSeen: payload.hostSeen,
      online: payload.online,
      routeLabel: payload.routeLabel,
      health: payload.health,
    },
    heading: {
      yawDeg: payload.yawDeg,
      targetYawDeg: payload.targetYawDeg,
      angularErrorDeg: payload.angularErrorDeg,
      lateralErrorM: payload.lateralErrorM,
    },
    perception: {
      frontMedianMm: payload.frontMedianMm,
      leftWallMm: payload.leftWallMm,
      rightWallMm: payload.rightWallMm,
      leftOpenMm: payload.leftOpenMm,
      rightOpenMm: payload.rightOpenMm,
      frontBlocked: payload.frontBlocked,
      frontSlow: payload.frontSlow,
      leftOpenFlag: payload.leftOpenFlag,
      rightOpenFlag: payload.rightOpenFlag,
      deadEnd: payload.deadEnd,
    },
    commands: {
      center: payload.center,
      forward: payload.forward,
      rotation: payload.rotation,
    },
    encoders: {
      leftMm: payload.leftMm,
      rightMm: payload.rightMm,
      backMm: payload.backMm,
      forwardDistanceCm: payload.forwardDistanceCm,
    },
    systems: {
      lidarHealthy: payload.lidarHealthy,
      navxConnected: payload.navxConnected,
      validScan: payload.validScan,
      gyroHold: payload.gyroHold,
    },
    battery: {
      voltageV: payload.voltageV,
      currentA: payload.currentA,
      powerW: payload.powerW,
      stateOfCharge: payload.stateOfCharge,
      estimatedRuntimeMin: payload.estimatedRuntimeMin,
    },
    reactive: {
      state: payload.reactiveState,
      decision: payload.decision,
      driveControl: payload.driveControl,
      lastTurn: payload.lastTurn,
      stateTimeSec: payload.stateTimeSec,
      stableScans: payload.stableScans,
      pendingTurnDirection: payload.pendingTurnDirection,
      pendingTurnArmed: payload.pendingTurnArmed,
      turnDetected: payload.turnDetected,
      turnExecutable: payload.turnExecutable,
    },
  })
}
