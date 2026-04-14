import { useEffect, useMemo, useRef, useState } from 'react'
import { clamp } from '../lib/format'
import {
  isRenderablePlanarPose,
  resolveSpatialPose,
  type ResolvedSpatialPose,
} from '../lib/spatialTelemetry'
import type { PlanarPoseData, PoseSourceOverride, TelemetrySnapshot } from '../types/telemetry'

const DEFAULT_VIEWPORT = {
  centerXMm: 0,
  centerYMm: 0,
  zoomPxPerMm: 0.12,
}

const MIN_ZOOM_PX_PER_MM = 0.035
const MAX_ZOOM_PX_PER_MM = 0.72
const TRAIL_MAX_POINTS = 720
const TRAIL_APPEND_DISTANCE_MM = 24
const TRAIL_APPEND_YAW_DEG = 3

export interface SpatialTrailPoint {
  xMm: number
  yMm: number
  yawDeg: number
  timestampMs: number
  source: PlanarPoseData['source']
  frame: string
}

export interface SpatialViewportState {
  centerXMm: number
  centerYMm: number
  zoomPxPerMm: number
}

export interface SpatialViewportSize {
  width: number
  height: number
}

export interface SpatialAnchorPoint {
  x: number
  y: number
}

export interface SpatialPoseTransitionState {
  previous: PlanarPoseData | null
  latest: PlanarPoseData | null
  receivedAtMs: number
  transitionMs: number
}

export interface SpatialViewModel {
  sourceOverride: PoseSourceOverride
  setSourceOverride: (override: PoseSourceOverride) => void
  selectedPose: ResolvedSpatialPose
  sourceStates: TelemetrySnapshot['poseSources']
  trail: SpatialTrailPoint[]
  viewport: SpatialViewportState
  poseTransition: SpatialPoseTransitionState
  centerOnRobot: () => void
  resetView: () => void
  clearTrail: () => void
  panViewport: (deltaXPx: number, deltaYPx: number) => void
  zoomViewport: (factor: number, anchor: SpatialAnchorPoint, viewportSize: SpatialViewportSize) => void
}

function normalizeAngleDelta(value: number) {
  let next = value

  while (next > 180) {
    next -= 360
  }

  while (next < -180) {
    next += 360
  }

  return next
}

function toTrailPoint(pose: PlanarPoseData): SpatialTrailPoint {
  return {
    xMm: pose.xMm,
    yMm: pose.yMm,
    yawDeg: pose.yawDeg,
    timestampMs: pose.timestampMs,
    source: pose.source,
    frame: pose.frame,
  }
}

function shouldAppendTrail(previous: SpatialTrailPoint | undefined, next: SpatialTrailPoint) {
  if (!previous) {
    return true
  }

  const distanceMm = Math.hypot(next.xMm - previous.xMm, next.yMm - previous.yMm)
  const headingDeltaDeg = Math.abs(normalizeAngleDelta(next.yawDeg - previous.yawDeg))

  return distanceMm >= TRAIL_APPEND_DISTANCE_MM || headingDeltaDeg >= TRAIL_APPEND_YAW_DEG
}

function poseTransitionChanged(previous: PlanarPoseData | null, next: PlanarPoseData) {
  if (!previous) {
    return true
  }

  return (
    previous.timestampMs !== next.timestampMs ||
    previous.sequence !== next.sequence ||
    previous.xMm !== next.xMm ||
    previous.yMm !== next.yMm ||
    previous.yawDeg !== next.yawDeg ||
    previous.freshness !== next.freshness ||
    previous.frame !== next.frame ||
    previous.source !== next.source
  )
}

export function useSpatialViewModel(snapshot: TelemetrySnapshot): SpatialViewModel {
  const [sourceOverride, setSourceOverride] = useState<PoseSourceOverride>('auto')
  const [viewport, setViewport] = useState<SpatialViewportState>(DEFAULT_VIEWPORT)
  const [trail, setTrail] = useState<SpatialTrailPoint[]>([])
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [poseTransition, setPoseTransition] = useState<SpatialPoseTransitionState>(() => ({
    previous: null,
    latest: null,
    receivedAtMs: performance.now(),
    transitionMs: 0,
  }))
  const trailContextRef = useRef<string | null>(null)
  const hasAutoCenteredRef = useRef(false)

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now())
    }, 250)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [])

  const selectedPose = useMemo(
    () => resolveSpatialPose(snapshot, sourceOverride, nowMs),
    [nowMs, snapshot, sourceOverride],
  )

  useEffect(() => {
    if (!selectedPose.isRenderable || hasAutoCenteredRef.current) {
      return
    }

    setViewport((current) => ({
      ...current,
      centerXMm: selectedPose.pose.xMm,
      centerYMm: selectedPose.pose.yMm,
    }))
    hasAutoCenteredRef.current = true
  }, [selectedPose.isRenderable, selectedPose.pose.xMm, selectedPose.pose.yMm])

  useEffect(() => {
    const pose = selectedPose.pose

    if (!isRenderablePlanarPose(pose)) {
      setPoseTransition({
        previous: null,
        latest: null,
        receivedAtMs: performance.now(),
        transitionMs: 0,
      })
      return
    }

    setPoseTransition((current) => {
      if (!poseTransitionChanged(current.latest, pose)) {
        return current
      }

      const canInterpolate =
        current.latest !== null &&
        current.latest.frame === pose.frame &&
        current.latest.source === pose.source &&
        current.latest.freshness === 'live' &&
        pose.freshness === 'live'
      const transitionMs =
        canInterpolate && current.latest !== null
          ? Math.max(60, Math.min(180, pose.timestampMs - current.latest.timestampMs || 120))
          : 0

      return {
        previous: canInterpolate ? current.latest : pose,
        latest: pose,
        receivedAtMs: performance.now(),
        transitionMs,
      }
    })
  }, [
    selectedPose.pose.available,
    selectedPose.pose.frame,
    selectedPose.pose.freshness,
    selectedPose.pose.sequence,
    selectedPose.pose.source,
    selectedPose.pose.timestampMs,
    selectedPose.pose.xMm,
    selectedPose.pose.yMm,
    selectedPose.pose.yawDeg,
  ])

  useEffect(() => {
    const pose = selectedPose.pose
    const nextContext =
      selectedPose.isRenderable && pose.frame
        ? `${sourceOverride}:${pose.source}:${pose.frame}`
        : null
    const contextChanged = trailContextRef.current !== nextContext

    if (!selectedPose.isRenderable) {
      trailContextRef.current = nextContext
      setTrail([])
      return
    }

    if (contextChanged) {
      trailContextRef.current = nextContext
      setTrail(pose.freshness === 'live' ? [toTrailPoint(pose)] : [])
      return
    }

    if (pose.freshness !== 'live') {
      trailContextRef.current = nextContext
      return
    }

    setTrail((current) => {
      const nextPoint = toTrailPoint(pose)
      const lastPoint = current[current.length - 1]

      if (!shouldAppendTrail(lastPoint, nextPoint)) {
        return current
      }

      return [...current, nextPoint].slice(-TRAIL_MAX_POINTS)
    })
  }, [
    selectedPose.isRenderable,
    selectedPose.pose.available,
    selectedPose.pose.frame,
    selectedPose.pose.freshness,
    selectedPose.pose.sequence,
    selectedPose.pose.source,
    selectedPose.pose.timestampMs,
    selectedPose.pose.xMm,
    selectedPose.pose.yMm,
    selectedPose.pose.yawDeg,
    sourceOverride,
  ])

  const centerOnRobot = () => {
    if (!selectedPose.isRenderable) {
      return
    }

    setViewport((current) => ({
      ...current,
      centerXMm: selectedPose.pose.xMm,
      centerYMm: selectedPose.pose.yMm,
    }))
  }

  const resetView = () => {
    setViewport({
      centerXMm: selectedPose.isRenderable ? selectedPose.pose.xMm : 0,
      centerYMm: selectedPose.isRenderable ? selectedPose.pose.yMm : 0,
      zoomPxPerMm: DEFAULT_VIEWPORT.zoomPxPerMm,
    })
  }

  const clearTrail = () => {
    if (!selectedPose.isRenderable || selectedPose.pose.freshness !== 'live') {
      setTrail([])
      return
    }

    setTrail([toTrailPoint(selectedPose.pose)])
  }

  const panViewport = (deltaXPx: number, deltaYPx: number) => {
    setViewport((current) => ({
      ...current,
      centerXMm: current.centerXMm - deltaXPx / current.zoomPxPerMm,
      centerYMm: current.centerYMm + deltaYPx / current.zoomPxPerMm,
    }))
  }

  const zoomViewport = (
    factor: number,
    anchor: SpatialAnchorPoint,
    viewportSize: SpatialViewportSize,
  ) => {
    if (viewportSize.width <= 0 || viewportSize.height <= 0 || factor === 1) {
      return
    }

    setViewport((current) => {
      const nextZoom = clamp(current.zoomPxPerMm * factor, MIN_ZOOM_PX_PER_MM, MAX_ZOOM_PX_PER_MM)
      if (nextZoom === current.zoomPxPerMm) {
        return current
      }

      const worldAnchorXMm =
        current.centerXMm + (anchor.x - viewportSize.width / 2) / current.zoomPxPerMm
      const worldAnchorYMm =
        current.centerYMm - (anchor.y - viewportSize.height / 2) / current.zoomPxPerMm

      return {
        centerXMm: worldAnchorXMm - (anchor.x - viewportSize.width / 2) / nextZoom,
        centerYMm: worldAnchorYMm + (anchor.y - viewportSize.height / 2) / nextZoom,
        zoomPxPerMm: nextZoom,
      }
    })
  }

  return {
    sourceOverride,
    setSourceOverride,
    selectedPose,
    sourceStates: snapshot.poseSources,
    trail,
    viewport,
    poseTransition,
    centerOnRobot,
    resetView,
    clearTrail,
    panViewport,
    zoomViewport,
  }
}
