import type {
  BridgeStatus,
  ControlModeFeed,
  ControlModeState,
  RawBackendTelemetry,
  RawNetworkTablesPayload,
  TelemetrySnapshot,
} from '../types/telemetry'
import { createBaseSnapshot } from './mockTelemetry'

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
    controlModeEndpoint: '/api/control-mode',
    connected: false,
    message: 'Bridge status unavailable.',
  }
}

export function adaptBackendTelemetry(payload: RawBackendTelemetry): TelemetrySnapshot {
  const base = createBaseSnapshot()

  return {
    ...base,
    timestamp: payload.timestamp ?? base.timestamp,
    scenarioLabel: payload.scenarioLabel ?? base.scenarioLabel,
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
    reactive: { ...base.reactive, ...payload.reactive },
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
