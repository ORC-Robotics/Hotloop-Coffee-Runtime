import { createPlanarPoseData } from '../data/mockTelemetry'
import type {
  PlanarPoseData,
  PlanarPoseSource,
  PoseSourceOverride,
  TelemetryPoseSourceKey,
  TelemetrySnapshot,
} from '../types/telemetry'

const MANUAL_SOURCE_BY_OVERRIDE: Record<Exclude<PoseSourceOverride, 'auto'>, TelemetryPoseSourceKey> = {
  odometry: 'odometry',
  reactive: 'reactive',
  mapeamento: 'mapeamento',
  simulation: 'simulation',
}

export const SPATIAL_POSE_SOURCE_LABELS: Record<PlanarPoseSource, string> = {
  odometry: 'Odometry',
  reactive: 'Reactive',
  mapeamento: 'Mapeamento',
  simulation: 'Simulation',
  none: 'None',
}

export const SPATIAL_POSE_OVERRIDE_OPTIONS: Array<{
  id: PoseSourceOverride
  label: string
  description: string
}> = [
  {
    id: 'auto',
    label: 'Auto',
    description: 'Prefer odometry first, then reactive, then mapeamento. Offline auto resolves to simulation.',
  },
  {
    id: 'odometry',
    label: 'Odometry',
    description: 'Session-local drivetrain odometry, independent from robot-side mapping.',
  },
  {
    id: 'reactive',
    label: 'Reactive',
    description: 'Pose emitted by reactive navigation when that stack is actively publishing.',
  },
  {
    id: 'mapeamento',
    label: 'Mapeamento',
    description: 'Optional debug pose from the mapping path. Not the default source for V1.',
  },
  {
    id: 'simulation',
    label: 'Simulation',
    description: 'Offline planar pose generated inside Hotloop for replay-friendly testing.',
  },
]

export interface ResolvedSpatialPose {
  override: PoseSourceOverride
  pose: PlanarPoseData
  selectedSourceKey: TelemetryPoseSourceKey | null
  selectedSourceLabel: string
  isRenderable: boolean
  isLive: boolean
  ageMs: number | null
}

export function resolvePoseSourceKey(override: PoseSourceOverride): TelemetryPoseSourceKey | null {
  if (override === 'auto') {
    return null
  }

  return MANUAL_SOURCE_BY_OVERRIDE[override]
}

export function poseSourceLabel(source: PlanarPoseSource) {
  return SPATIAL_POSE_SOURCE_LABELS[source] ?? source
}

export function isRenderablePlanarPose(pose: PlanarPoseData) {
  return pose.available && pose.freshness !== 'invalid'
}

export function resolveSpatialPose(
  snapshot: TelemetrySnapshot,
  override: PoseSourceOverride,
  nowMs = Date.now(),
): ResolvedSpatialPose {
  const selectedSourceKey = resolvePoseSourceKey(override)
  const fallbackPose = createPlanarPoseData(selectedSourceKey ?? 'none', {
    available: false,
    freshness: 'invalid',
  })
  const pose =
    override === 'auto'
      ? snapshot.pose ?? fallbackPose
      : snapshot.poseSources[MANUAL_SOURCE_BY_OVERRIDE[override]] ?? fallbackPose
  const ageMs = pose.timestampMs > 0 ? Math.max(0, nowMs - pose.timestampMs) : null

  return {
    override,
    pose,
    selectedSourceKey,
    selectedSourceLabel:
      override === 'auto'
        ? `Auto (${poseSourceLabel(pose.source)})`
        : poseSourceLabel(pose.source),
    isRenderable: isRenderablePlanarPose(pose),
    isLive: pose.available && pose.freshness === 'live',
    ageMs,
  }
}

export function formatPoseAgeLabel(ageMs: number | null) {
  if (ageMs === null) {
    return '--'
  }

  if (ageMs < 1000) {
    return `${Math.round(ageMs)} ms`
  }

  return `${(ageMs / 1000).toFixed(ageMs >= 10_000 ? 0 : 1)} s`
}
