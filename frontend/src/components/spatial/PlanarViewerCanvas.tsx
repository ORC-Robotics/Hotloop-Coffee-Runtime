import {
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react'
import { clamp } from '../../lib/format'
import { cn } from '../../lib/cn'
import {
  decodeSpatialLidarPoints,
  formatPoseAgeLabel,
  type SpatialScanRegistration,
  type ResolvedSpatialLidar,
  type ResolvedSpatialPose,
} from '../../lib/spatialTelemetry'
import type {
  SpatialGoalPreview,
  SpatialOccupancyDisplayMode,
  SpatialOccupancyLayer,
  SpatialBufferedLidarScan,
  SpatialObservedMapScan,
  SpatialPoseTransitionState,
  SpatialReplaySelection,
  SpatialTrailPoint,
  SpatialViewportState,
} from '../../hooks/useSpatialViewModel'
import type { GuidedNavigationState } from '../../hooks/useGuidedNavigation'
import {
  type PlanarSceneBufferedLidar,
  drawPlanarScene,
  type PlanarSceneGoalPreview,
  type PlanarSceneLidar,
  type PlanarSceneOccupancyLayer,
  type PlanarSceneObservedMap,
  type PlanarScenePalette,
  type PlanarScenePose,
  type PlanarSceneRegistration,
} from './planarSceneRenderer'

interface PlanarViewerCanvasProps {
  poseSelection: ResolvedSpatialPose
  lidarSelection: ResolvedSpatialLidar
  scanRegistration: SpatialScanRegistration
  poseTransition: SpatialPoseTransitionState
  trail: SpatialTrailPoint[]
  lidarHistory: SpatialBufferedLidarScan[]
  observedMapScans: SpatialObservedMapScan[]
  observedMapFadeOlderScans: boolean
  observedMapFrozen: boolean
  occupancyLayer: SpatialOccupancyLayer | null
  showOccupancyLayer: boolean
  occupancyDisplayMode: SpatialOccupancyDisplayMode
  goalPreview: SpatialGoalPreview
  guidedNavigation?: GuidedNavigationState
  replaySelection: SpatialReplaySelection | null
  viewport: SpatialViewportState
  followRobot: boolean
  onPanViewport: (deltaXPx: number, deltaYPx: number) => void
  onZoomViewport: (
    factor: number,
    anchor: { x: number; y: number },
    viewportSize: { width: number; height: number },
  ) => void
  onRotateViewport: (deltaDeg: number) => void
  onToggleFollowRobot: () => void
  onCenterRobot: () => void
  onResetView: () => void
  onClearTrail: () => void
  onClearLidarHistory: () => void
  onClearObservedMap: () => void
  onToggleObservedMapFrozen: () => void
  onToggleOccupancyLayer: () => void
  onSelectGoalAtWorldPoint: (point: { xMm: number; yMm: number }) => void
  onArmGoalPreview: () => void
  onDisarmGoalPreview: () => void
  onClearGoalPreview: () => void
  variant?: 'workspace' | 'widget'
  requireCtrlForInteraction?: boolean
}

interface PointerDragState {
  pointerId: number
  startX: number
  startY: number
  lastX: number
  lastY: number
  moved: boolean
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

function buildPalette(target: HTMLElement): PlanarScenePalette {
  const styles = getComputedStyle(target)
  const resolve = (variableName: string, fallback: string) => {
    const resolved = styles.getPropertyValue(variableName).trim()
    return resolved || fallback
  }

  return {
    background: resolve('--surface', '#0b1320'),
    surface: resolve('--surface-alt', '#101b2b'),
    gridMinor: resolve('--border', '#263245'),
    gridMajor: resolve('--text-muted', '#6b7a90'),
    axisX: resolve('--warning', '#f59e0b'),
    axisY: resolve('--info', '#38bdf8'),
    axisOrigin: resolve('--text', '#f8fafc'),
    trail: resolve('--accent', '#2dd4bf'),
    robotFill: resolve('--surface-alt', '#152334'),
    robotStroke: resolve('--text', '#e5eef7'),
    heading: resolve('--primary', '#7dd3fc'),
    lidarSweep: resolve('--info', '#38bdf8'),
    lidarPoint: resolve('--accent', '#2dd4bf'),
    lidarGhost: resolve('--text-muted', '#6b7a90'),
    observedMapPoint: resolve('--text-muted', '#6b7a90'),
    observedMapRecent: resolve('--accent', '#2dd4bf'),
    occupancyFree: resolve('--info', '#38bdf8'),
    occupancyOccupied: resolve('--warning', '#f59e0b'),
    occupancyMixed: resolve('--accent', '#2dd4bf'),
    goalReady: resolve('--primary', '#7dd3fc'),
    goalArmed: resolve('--accent', '#2dd4bf'),
    goalBlocked: resolve('--warning', '#f59e0b'),
    registrationSweep: resolve('--warning', '#f59e0b'),
    registrationPoint: resolve('--warning', '#f59e0b'),
  }
}

function matchesEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'))
}

function screenToWorld(
  point: { x: number; y: number },
  viewport: SpatialViewportState,
  canvasSize: { width: number; height: number },
) {
  const rotationRad = (viewport.rotationDeg * Math.PI) / 180
  const cosRotation = Math.cos(rotationRad)
  const sinRotation = Math.sin(rotationRad)
  const viewXMm = (point.x - canvasSize.width / 2) / viewport.zoomPxPerMm
  const viewYMm = -(point.y - canvasSize.height / 2) / viewport.zoomPxPerMm

  return {
    xMm: viewport.centerXMm + viewXMm * cosRotation - viewYMm * sinRotation,
    yMm: viewport.centerYMm + viewXMm * sinRotation + viewYMm * cosRotation,
  }
}

function formatViewportRotation(rotationDeg: number) {
  const normalizedRotation = ((Math.round(rotationDeg) % 360) + 360) % 360
  return normalizedRotation === 0 ? 'N Up' : `View ${normalizedRotation} deg`
}

function interpolatePose(
  poseTransition: SpatialPoseTransitionState,
  nowMs: number,
): PlanarScenePose | null {
  const latest = poseTransition.latest
  if (!latest || !latest.available || latest.freshness === 'invalid') {
    return null
  }

  const previous = poseTransition.previous
  if (
    !previous ||
    poseTransition.transitionMs <= 0 ||
    previous.frame !== latest.frame ||
    previous.source !== latest.source ||
    previous.freshness !== 'live' ||
    latest.freshness !== 'live'
  ) {
    return latest
  }

  const progress = clamp((nowMs - poseTransition.receivedAtMs) / poseTransition.transitionMs, 0, 1)

  return {
    xMm: previous.xMm + (latest.xMm - previous.xMm) * progress,
    yMm: previous.yMm + (latest.yMm - previous.yMm) * progress,
    yawDeg: previous.yawDeg + normalizeAngleDelta(latest.yawDeg - previous.yawDeg) * progress,
    freshness: latest.freshness,
    frame: latest.frame,
    source: latest.source,
  }
}

function buildSceneLidar(
  lidarSelection: ResolvedSpatialLidar,
  pose: PlanarScenePose | null,
): PlanarSceneLidar | null {
  if (!pose || !lidarSelection.isRenderable) {
    return null
  }

  const points = decodeSpatialLidarPoints(lidarSelection.scan)

  if (points.length === 0) {
    return null
  }

  return {
    freshness: lidarSelection.scan.freshness,
    frame: lidarSelection.scan.frame,
    poseFrame: lidarSelection.scan.poseFrame,
    points,
  }
}

function buildSceneLidarHistory(history: SpatialBufferedLidarScan[]): PlanarSceneBufferedLidar[] {
  return history.map((scan) => ({
    freshness: scan.freshness,
    frame: scan.frame,
    poseFrame: scan.poseFrame,
    pose: {
      xMm: scan.pose.xMm,
      yMm: scan.pose.yMm,
      yawDeg: scan.pose.yawDeg,
      freshness: scan.freshness,
      frame: scan.pose.frame,
      source: scan.pose.source,
    },
    points: scan.points,
  }))
}

function buildObservedMap(
  observedMapScans: SpatialObservedMapScan[],
  fadeOlderScans: boolean,
): PlanarSceneObservedMap | null {
  if (observedMapScans.length === 0) {
    return null
  }

  return {
    frame: observedMapScans[observedMapScans.length - 1]?.frame ?? 'none',
    fadeOlderScans,
    scans: observedMapScans.map((scan) => ({
      timestampMs: scan.timestampMs,
      sequence: scan.sequence,
      frame: scan.frame,
      pointCount: scan.pointCount,
      points: scan.points,
    })),
  }
}

function buildOccupancyLayer(
  occupancyLayer: SpatialOccupancyLayer | null,
): PlanarSceneOccupancyLayer | null {
  if (!occupancyLayer || occupancyLayer.cells.length === 0) {
    return null
  }

  return {
    frame: occupancyLayer.frame,
    cellSizeMm: occupancyLayer.cellSizeMm,
    cells: occupancyLayer.cells.map((cell) => ({
      centerXMm: cell.centerXMm,
      centerYMm: cell.centerYMm,
      freeCount: cell.freeCount,
      occupiedCount: cell.occupiedCount,
      state: cell.state,
      confidence: cell.confidence,
    })),
  }
}

function buildReplayPose(replaySelection: SpatialReplaySelection | null): PlanarScenePose | null {
  if (!replaySelection) {
    return null
  }

  return {
    xMm: replaySelection.scan.pose.xMm,
    yMm: replaySelection.scan.pose.yMm,
    yawDeg: replaySelection.scan.pose.yawDeg,
    freshness: replaySelection.scan.freshness === 'invalid' ? 'stale' : replaySelection.scan.freshness,
    frame: replaySelection.scan.pose.frame,
    source: replaySelection.scan.pose.source,
  }
}

function buildReplayLidar(replaySelection: SpatialReplaySelection | null): PlanarSceneLidar | null {
  if (!replaySelection) {
    return null
  }

  return {
    freshness: replaySelection.scan.freshness,
    frame: replaySelection.scan.frame,
    poseFrame: replaySelection.scan.poseFrame,
    points: replaySelection.scan.points,
  }
}

function buildRegistrationOverlay(
  scanRegistration: SpatialScanRegistration,
): PlanarSceneRegistration | null {
  if (!scanRegistration.available || scanRegistration.alignedReferencePoints.length === 0) {
    return null
  }

  return {
    quality: scanRegistration.quality,
    points: scanRegistration.alignedReferencePoints,
  }
}

function buildGoalPreviewSceneModel(goalPreview: SpatialGoalPreview): PlanarSceneGoalPreview | null {
  if (goalPreview.status === 'idle' || goalPreview.requestedXMm === null || goalPreview.requestedYMm === null) {
    return null
  }

  if (goalPreview.status === 'unavailable') {
    return null
  }

  return {
    status:
      goalPreview.status === 'ready' || goalPreview.status === 'armed'
        ? goalPreview.status
        : goalPreview.target
          ? 'unreachable'
          : 'blocked',
    requestedXMm: goalPreview.requestedXMm,
    requestedYMm: goalPreview.requestedYMm,
    targetXMm: goalPreview.target?.snappedXMm ?? null,
    targetYMm: goalPreview.target?.snappedYMm ?? null,
    targetYawDeg: goalPreview.targetYawDeg,
    path: goalPreview.path,
  }
}

function OverlayButton({
  label,
  onClick,
  compact = false,
  title,
}: {
  label: string
  onClick: () => void
  compact?: boolean
  title?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        'pointer-events-auto rounded-full border border-[var(--border)] bg-[var(--surface)]/88 font-semibold uppercase tracking-[0.14em] text-[var(--text)] backdrop-blur-sm transition-colors hover:bg-[var(--surface-alt)]',
        compact ? 'px-3 py-1.5 text-[0.64rem]' : 'px-3.5 py-2 text-[0.68rem]',
      )}
    >
      {label}
    </button>
  )
}

function OverlayInfoChip({
  label,
}: {
  label: string
}) {
  return (
    <div className="rounded-full border border-[var(--border)] bg-[var(--surface)]/88 px-3 py-1.5 text-[0.64rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)] backdrop-blur-sm">
      {label}
    </div>
  )
}

export function PlanarViewerCanvas({
  poseSelection,
  lidarSelection,
  scanRegistration,
  poseTransition,
  trail,
  lidarHistory,
  observedMapScans,
  observedMapFadeOlderScans,
  observedMapFrozen,
  occupancyLayer,
  showOccupancyLayer,
  occupancyDisplayMode,
  goalPreview,
  guidedNavigation,
  replaySelection,
  viewport,
  followRobot,
  onPanViewport,
  onZoomViewport,
  onRotateViewport,
  onToggleFollowRobot,
  onCenterRobot,
  onResetView,
  onClearTrail,
  onClearLidarHistory,
  onClearObservedMap,
  onToggleObservedMapFrozen,
  onToggleOccupancyLayer,
  onSelectGoalAtWorldPoint,
  onArmGoalPreview,
  onDisarmGoalPreview,
  onClearGoalPreview,
  variant = 'workspace',
  requireCtrlForInteraction = false,
}: PlanarViewerCanvasProps) {
  const shellRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const dragStateRef = useRef<PointerDragState | null>(null)
  const [canvasSize, setCanvasSize] = useState({ width: 1, height: 1 })
  const [isDragging, setIsDragging] = useState(false)
  const [modifierActive, setModifierActive] = useState(false)
  const widgetVariant = variant === 'widget'
  const interactionModifierActive = !requireCtrlForInteraction || modifierActive
  const cursorClassName = isDragging
    ? 'cursor-grabbing'
    : requireCtrlForInteraction
      ? interactionModifierActive
        ? 'cursor-grab'
        : 'cursor-default'
      : 'cursor-grab'
  const goalActionLabel =
    goalPreview.status === 'armed'
      ? widgetVariant
        ? 'Disarm Goal'
        : 'Disarm Goal'
      : goalPreview.status === 'ready'
        ? widgetVariant
          ? 'Arm Goal'
          : 'Arm Goal'
        : widgetVariant
          ? 'Clear Goal'
          : 'Clear Goal'
  const navStatusLabel = guidedNavigation
    ? guidedNavigation.active
      ? 'Nav Running'
      : guidedNavigation.canStart
        ? 'Nav Ready'
        : guidedNavigation.status === 'idle'
          ? 'Nav Idle'
          : `Nav ${guidedNavigation.status}`
    : null
  const navActionLabel = guidedNavigation
    ? guidedNavigation.active
      ? widgetVariant
        ? 'Stop Nav'
        : 'Stop Guided'
      : guidedNavigation.canStart
        ? widgetVariant
          ? 'Start Nav'
          : 'Start Guided'
        : widgetVariant
          ? 'Check Nav'
          : 'Check Guided'
    : null
  const handleGuidedNavigationAction = () => {
    if (!guidedNavigation) {
      return
    }

    if (guidedNavigation.active) {
      guidedNavigation.stopGuidedNavigation()
      return
    }

    guidedNavigation.startGuidedNavigation()
  }
  const sceneSnapshot = useMemo(
    () => ({
      trail,
      viewport,
      poseTransition,
      poseSelection,
      lidarSelection,
      scanRegistration,
      lidarHistory,
      observedMapScans,
      observedMapFadeOlderScans,
      observedMapFrozen,
      occupancyLayer,
      showOccupancyLayer,
      occupancyDisplayMode,
      goalPreview,
      replaySelection,
    }),
    [
      lidarHistory,
      lidarSelection,
      occupancyDisplayMode,
      goalPreview,
      occupancyLayer,
      observedMapFadeOlderScans,
      observedMapFrozen,
      observedMapScans,
      poseSelection,
      poseTransition,
      replaySelection,
      scanRegistration,
      showOccupancyLayer,
      trail,
      viewport,
    ],
  )

  useEffect(() => {
    const element = shellRef.current
    if (!element) {
      return
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) {
        return
      }

      setCanvasSize({
        width: Math.max(1, entry.contentRect.width),
        height: Math.max(1, entry.contentRect.height),
      })
    })

    observer.observe(element)

    return () => {
      observer.disconnect()
    }
  }, [])

  useEffect(() => {
    if (!requireCtrlForInteraction) {
      return
    }

    const handleKeyState = (event: KeyboardEvent) => {
      setModifierActive(event.ctrlKey)
    }

    const resetModifier = () => {
      setModifierActive(false)
    }

    window.addEventListener('keydown', handleKeyState)
    window.addEventListener('keyup', handleKeyState)
    window.addEventListener('blur', resetModifier)

    return () => {
      window.removeEventListener('keydown', handleKeyState)
      window.removeEventListener('keyup', handleKeyState)
      window.removeEventListener('blur', resetModifier)
    }
  }, [requireCtrlForInteraction])

  const renderFrame = useEffectEvent((timestampMs: number) => {
    const canvas = canvasRef.current
    const shell = shellRef.current
    if (!canvas || !shell) {
      return
    }

    const context = canvas.getContext('2d')
    if (!context) {
      return
    }

    const { width, height } = canvasSize
    const dpr = window.devicePixelRatio || 1
    const deviceWidth = Math.max(1, Math.round(width * dpr))
    const deviceHeight = Math.max(1, Math.round(height * dpr))

    if (canvas.width !== deviceWidth || canvas.height !== deviceHeight) {
      canvas.width = deviceWidth
      canvas.height = deviceHeight
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
    }

    context.setTransform(dpr, 0, 0, dpr, 0, 0)

    const livePose = interpolatePose(sceneSnapshot.poseTransition, timestampMs)
    const pose = buildReplayPose(sceneSnapshot.replaySelection) ?? livePose

    drawPlanarScene(context, {
      widthPx: width,
      heightPx: height,
      viewport: sceneSnapshot.viewport,
      palette: buildPalette(shell),
      trail: sceneSnapshot.trail,
      pose,
      observedMap: buildObservedMap(
        sceneSnapshot.observedMapScans,
        sceneSnapshot.observedMapFadeOlderScans,
      ),
      occupancy: buildOccupancyLayer(sceneSnapshot.occupancyLayer),
      goalPreview: buildGoalPreviewSceneModel(sceneSnapshot.goalPreview),
      lidarHistory: buildSceneLidarHistory(sceneSnapshot.lidarHistory),
      registration: buildRegistrationOverlay(sceneSnapshot.scanRegistration),
      lidar:
        buildReplayLidar(sceneSnapshot.replaySelection) ??
        buildSceneLidar(sceneSnapshot.lidarSelection, pose),
    })
  })

  useEffect(() => {
    let animationFrameId = 0

    const tick = (timestampMs: number) => {
      renderFrame(timestampMs)
      animationFrameId = window.requestAnimationFrame(tick)
    }

    animationFrameId = window.requestAnimationFrame(tick)

    return () => {
      window.cancelAnimationFrame(animationFrameId)
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (matchesEditableTarget(event.target)) {
        return
      }

      if (event.code === 'KeyN') {
        if (goalPreview.status === 'ready') {
          event.preventDefault()
          onArmGoalPreview()
        } else if (goalPreview.status === 'armed') {
          event.preventDefault()
          onDisarmGoalPreview()
        }
      }

      if (event.code === 'Escape') {
        if (goalPreview.status !== 'idle') {
          event.preventDefault()
          onClearGoalPreview()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [
    goalPreview.status,
    onArmGoalPreview,
    onClearGoalPreview,
    onDisarmGoalPreview,
  ])

  const handleWheel = (event: ReactWheelEvent<HTMLCanvasElement>) => {
    if (requireCtrlForInteraction && !event.ctrlKey) {
      return
    }

    event.preventDefault()
    const rect = event.currentTarget.getBoundingClientRect()
    const factor = event.deltaY < 0 ? 1.1 : 1 / 1.1

    onZoomViewport(
      factor,
      {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      },
      canvasSize,
    )
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0) {
      return
    }

    if (requireCtrlForInteraction && !event.ctrlKey) {
      return
    }

    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      moved: false,
    }

    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const dragState = dragStateRef.current
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return
    }

    const moved =
      dragState.moved ||
      Math.hypot(event.clientX - dragState.startX, event.clientY - dragState.startY) >= 5

    if (moved) {
      onPanViewport(event.clientX - dragState.lastX, event.clientY - dragState.lastY)
      if (!dragState.moved) {
        setIsDragging(true)
      }
    }

    dragStateRef.current = {
      ...dragState,
      lastX: event.clientX,
      lastY: event.clientY,
      moved,
    }
  }

  const handlePointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const dragState = dragStateRef.current
    if (dragState?.pointerId === event.pointerId) {
      if (!dragState.moved && (!requireCtrlForInteraction || event.ctrlKey)) {
        const rect = event.currentTarget.getBoundingClientRect()
        onSelectGoalAtWorldPoint(
          screenToWorld(
            {
              x: event.clientX - rect.left,
              y: event.clientY - rect.top,
            },
            viewport,
            canvasSize,
          ),
        )
      }

      dragStateRef.current = null
      setIsDragging(false)
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  return (
    <div
      ref={shellRef}
      className={cn(
        'relative h-full overflow-hidden rounded-[22px] border border-[var(--border)] bg-[var(--surface)]/70',
        widgetVariant ? 'min-h-0' : 'min-h-[520px]',
      )}
    >
      <canvas
        ref={canvasRef}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={cn('h-full w-full touch-none', cursorClassName)}
      />

      <div
        className={cn(
          'pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-start justify-between gap-3',
          widgetVariant ? 'px-3 py-3' : 'px-4 py-4',
        )}
      >
        {widgetVariant ? (
          <>
            <div className="flex flex-wrap gap-2">
              <OverlayInfoChip
                label={
                  replaySelection
                    ? `Replay ${replaySelection.index + 1}/${replaySelection.total}`
                    : 'Live'
                }
              />
              <OverlayInfoChip label={`Goal ${goalPreview.status}`} />
              {navStatusLabel ? <OverlayInfoChip label={navStatusLabel} /> : null}
              <OverlayInfoChip
                label={
                  showOccupancyLayer
                    ? occupancyDisplayMode === 'free-and-occupied'
                      ? 'Occupancy Full'
                      : 'Occupancy Occupied'
                    : 'Occupancy Hidden'
                }
              />
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <OverlayButton compact label={followRobot ? 'Following' : 'Follow'} onClick={onToggleFollowRobot} />
              <OverlayButton compact label="Center" onClick={onCenterRobot} />
              <OverlayButton compact label="Reset" onClick={onResetView} />
              <OverlayButton compact label={'\u21b6'} title="Rotate view left" onClick={() => onRotateViewport(-90)} />
              <OverlayButton compact label={'\u21b7'} title="Rotate view right" onClick={() => onRotateViewport(90)} />
              <OverlayButton
                compact
                label={showOccupancyLayer ? 'Hide Occ' : 'Show Occ'}
                onClick={onToggleOccupancyLayer}
              />
              {goalPreview.status !== 'idle' ? (
                <OverlayButton
                  compact
                  label={goalActionLabel}
                  onClick={
                    goalPreview.status === 'armed'
                      ? onDisarmGoalPreview
                      : goalPreview.status === 'ready'
                        ? onArmGoalPreview
                        : onClearGoalPreview
                  }
                />
              ) : null}
              {guidedNavigation && navActionLabel ? (
                <OverlayButton
                  compact
                  label={navActionLabel}
                  onClick={handleGuidedNavigationAction}
                />
              ) : null}
            </div>
          </>
        ) : (
          <>
            <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface)]/86 px-3 py-2 text-[0.72rem] leading-6 text-[var(--text-muted)] backdrop-blur-sm">
              <div>
                {requireCtrlForInteraction
                  ? 'Hold Ctrl to pan, zoom or click a free area for a path preview.'
                  : 'Click a visited free area to preview a path. Drag to pan and use the mouse wheel to zoom.'}
              </div>
              <div>Press N to arm the current preview locally. Press Esc to clear the target.</div>
              <div>Compact LiDAR overlays only when its pose frame matches the selected source.</div>
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <OverlayButton label={followRobot ? 'Following Robot' : 'Follow Robot'} onClick={onToggleFollowRobot} />
              <OverlayButton label="Center on Robot" onClick={onCenterRobot} />
              <OverlayButton label="Reset View" onClick={onResetView} />
              <OverlayButton label={'\u21b6'} title="Rotate view left" onClick={() => onRotateViewport(-90)} />
              <OverlayButton label={'\u21b7'} title="Rotate view right" onClick={() => onRotateViewport(90)} />
              <OverlayButton label="Clear Trail" onClick={onClearTrail} />
              <OverlayButton
                label={showOccupancyLayer ? 'Hide Occupancy' : 'Show Occupancy'}
                onClick={onToggleOccupancyLayer}
              />
              <OverlayButton
                label={observedMapFrozen ? 'Resume Map' : 'Freeze Map'}
                onClick={onToggleObservedMapFrozen}
              />
              {goalPreview.status !== 'idle' ? (
                <OverlayButton
                  label={goalActionLabel}
                  onClick={
                    goalPreview.status === 'armed'
                      ? onDisarmGoalPreview
                      : goalPreview.status === 'ready'
                        ? onArmGoalPreview
                        : onClearGoalPreview
                  }
                />
              ) : null}
              {guidedNavigation && navActionLabel ? (
                <OverlayButton
                  label={navActionLabel}
                  onClick={handleGuidedNavigationAction}
                />
              ) : null}
              <OverlayButton label="Clear Map" onClick={onClearObservedMap} />
              <OverlayButton label="Clear Scan Buffer" onClick={onClearLidarHistory} />
            </div>
          </>
        )}
      </div>

      {!widgetVariant ? (
        replaySelection ? (
          <div className="pointer-events-none absolute left-4 top-24 rounded-[18px] border border-[var(--border)] bg-[var(--surface)]/88 px-3 py-2 text-[0.72rem] leading-6 text-[var(--text-muted)] backdrop-blur-sm">
            <div className="font-semibold uppercase tracking-[0.14em] text-[var(--text)]">Replay Mode</div>
            <div>
              Sample {replaySelection.index + 1}/{replaySelection.total} | Seq {replaySelection.scan.sequence}
            </div>
            <div>
              Captured {new Date(replaySelection.scan.timestampMs).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}{' '}
              | {formatPoseAgeLabel(replaySelection.ageMs)} old
            </div>
          </div>
        ) : (
          <div className="pointer-events-none absolute left-4 top-24 rounded-[18px] border border-[var(--border)] bg-[var(--surface)]/88 px-3 py-2 text-[0.72rem] leading-6 text-[var(--text-muted)] backdrop-blur-sm">
            <div className="font-semibold uppercase tracking-[0.14em] text-[var(--text)]">Live Mode</div>
            <div>The viewer is following the latest pose and current compact LiDAR sample.</div>
          </div>
        )
      ) : null}

      <div
        className={cn(
          'pointer-events-none absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-3',
          widgetVariant ? 'px-3 py-3' : 'px-4 py-4',
        )}
      >
        {widgetVariant ? (
          <>
            <div className="flex flex-wrap gap-2">
              <OverlayInfoChip label={`Zoom ${Math.round(viewport.zoomPxPerMm * 1000)} px/m`} />
              <OverlayInfoChip label={formatViewportRotation(viewport.rotationDeg)} />
              <OverlayInfoChip label={`Trail ${trail.length}`} />
              <OverlayInfoChip label={`Scans ${observedMapScans.length}`} />
              {requireCtrlForInteraction ? <OverlayInfoChip label={interactionModifierActive ? 'Ctrl Armed' : 'Hold Ctrl'} /> : null}
              <OverlayInfoChip
                label={
                  lidarSelection.isRenderable
                    ? `LiDAR ${lidarSelection.scan.validPointCount}/${lidarSelection.scan.pointCount}`
                    : `LiDAR ${lidarSelection.renderState}`
                }
              />
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <OverlayInfoChip label={poseSelection.selectedSourceLabel} />
              <OverlayInfoChip
                label={
                  scanRegistration.available && scanRegistration.meanResidualMm !== null
                    ? `Reg ${scanRegistration.quality}`
                    : 'Reg Unavailable'
                }
              />
            </div>
          </>
        ) : (
          <>
            <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface)]/88 px-3 py-2 text-[0.72rem] leading-6 text-[var(--text-muted)] backdrop-blur-sm">
              <div>Zoom {Math.round(viewport.zoomPxPerMm * 1000)} px/m</div>
              <div>{formatViewportRotation(viewport.rotationDeg)}</div>
              <div>Trail {trail.length} pts</div>
              <div>Follow robot {followRobot ? 'enabled' : 'off'}</div>
              {requireCtrlForInteraction ? <div>Interaction requires Ctrl</div> : null}
              <div>
                Observed map {observedMapScans.length} scans |{' '}
                {observedMapScans.reduce((total, scan) => total + scan.pointCount, 0)} pts
              </div>
              <div>Observed map mode {observedMapFrozen ? 'frozen' : 'live'}</div>
              <div>
                Occupancy{' '}
                {showOccupancyLayer && occupancyLayer
                  ? `${occupancyLayer.cells.length} cells | ${occupancyDisplayMode}`
                  : showOccupancyLayer
                    ? 'building'
                    : 'hidden'}
              </div>
              <div>Buffered scans {lidarHistory.length}</div>
              <div>
                LiDAR{' '}
                {lidarSelection.isRenderable
                  ? `${lidarSelection.scan.validPointCount}/${lidarSelection.scan.pointCount} pts`
                  : lidarSelection.renderState}
              </div>
              <div>
                Registration{' '}
                {scanRegistration.available && scanRegistration.meanResidualMm !== null
                  ? `${scanRegistration.quality} | ${Math.round(scanRegistration.meanResidualMm)} mm`
                  : 'unavailable'}
              </div>
              <div>
                Goal preview{' '}
                {goalPreview.status === 'idle'
                  ? 'idle'
                  : goalPreview.target
                    ? `${goalPreview.status} | ${goalPreview.path.length} pts`
                    : goalPreview.status}
              </div>
              {guidedNavigation ? (
                <div>
                  Guided nav{' '}
                  {guidedNavigation.canStart || guidedNavigation.active
                    ? guidedNavigation.status
                    : guidedNavigation.startBlockedReasons.join(', ') || guidedNavigation.status}
                </div>
              ) : null}
            </div>

            <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface)]/88 px-3 py-2 text-right text-[0.72rem] leading-6 text-[var(--text-muted)] backdrop-blur-sm">
              <div>{poseSelection.selectedSourceLabel}</div>
              <div>{poseSelection.isRenderable ? `${poseSelection.pose.frame} frame` : 'No valid pose selected'}</div>
            </div>
          </>
        )}
      </div>

      {!poseSelection.isRenderable ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6">
          <div className="max-w-[360px] rounded-[22px] border border-dashed border-[var(--border)] bg-[var(--surface)]/88 px-5 py-5 text-center text-[0.84rem] leading-7 text-[var(--text-muted)] backdrop-blur-sm">
            No valid planar pose is available for the selected source. Switch the override or start a live source to validate robot motion.
          </div>
        </div>
      ) : null}
    </div>
  )
}
