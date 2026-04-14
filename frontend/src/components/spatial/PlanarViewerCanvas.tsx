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
import { type ResolvedSpatialPose } from '../../lib/spatialTelemetry'
import type {
  SpatialPoseTransitionState,
  SpatialTrailPoint,
  SpatialViewportState,
} from '../../hooks/useSpatialViewModel'
import {
  drawPlanarScene,
  type PlanarScenePalette,
  type PlanarScenePose,
} from './planarSceneRenderer'

interface PlanarViewerCanvasProps {
  poseSelection: ResolvedSpatialPose
  poseTransition: SpatialPoseTransitionState
  trail: SpatialTrailPoint[]
  viewport: SpatialViewportState
  onPanViewport: (deltaXPx: number, deltaYPx: number) => void
  onZoomViewport: (
    factor: number,
    anchor: { x: number; y: number },
    viewportSize: { width: number; height: number },
  ) => void
  onCenterRobot: () => void
  onResetView: () => void
  onClearTrail: () => void
}

interface PointerDragState {
  pointerId: number
  lastX: number
  lastY: number
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
  }
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

function OverlayButton({
  label,
  onClick,
}: {
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="pointer-events-auto rounded-full border border-[var(--border)] bg-[var(--surface)]/88 px-3.5 py-2 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[var(--text)] backdrop-blur-sm transition-colors hover:bg-[var(--surface-alt)]"
    >
      {label}
    </button>
  )
}

export function PlanarViewerCanvas({
  poseSelection,
  poseTransition,
  trail,
  viewport,
  onPanViewport,
  onZoomViewport,
  onCenterRobot,
  onResetView,
  onClearTrail,
}: PlanarViewerCanvasProps) {
  const shellRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const dragStateRef = useRef<PointerDragState | null>(null)
  const [canvasSize, setCanvasSize] = useState({ width: 1, height: 1 })
  const [isDragging, setIsDragging] = useState(false)
  const cursorClassName = isDragging ? 'cursor-grabbing' : 'cursor-grab'
  const sceneSnapshot = useMemo(
    () => ({
      trail,
      viewport,
      poseTransition,
      poseSelection,
    }),
    [poseSelection, poseTransition, trail, viewport],
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

    drawPlanarScene(context, {
      widthPx: width,
      heightPx: height,
      viewport: sceneSnapshot.viewport,
      palette: buildPalette(shell),
      trail: sceneSnapshot.trail,
      pose: interpolatePose(sceneSnapshot.poseTransition, timestampMs),
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
  }, [renderFrame])

  const handleWheel = (event: ReactWheelEvent<HTMLCanvasElement>) => {
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
    dragStateRef.current = {
      pointerId: event.pointerId,
      lastX: event.clientX,
      lastY: event.clientY,
    }
    setIsDragging(true)

    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const dragState = dragStateRef.current
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return
    }

    onPanViewport(event.clientX - dragState.lastX, event.clientY - dragState.lastY)
    dragStateRef.current = {
      ...dragState,
      lastX: event.clientX,
      lastY: event.clientY,
    }
  }

  const handlePointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (dragStateRef.current?.pointerId === event.pointerId) {
      dragStateRef.current = null
      setIsDragging(false)
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  return (
    <div
      ref={shellRef}
      className="relative h-full min-h-[520px] overflow-hidden rounded-[22px] border border-[var(--border)] bg-[var(--surface)]/70"
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

      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-start justify-between gap-3 px-4 py-4">
        <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface)]/86 px-3 py-2 text-[0.72rem] leading-6 text-[var(--text-muted)] backdrop-blur-sm">
          Drag to pan. Use the mouse wheel to zoom the SE(2) view around the cursor.
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <OverlayButton label="Center on Robot" onClick={onCenterRobot} />
          <OverlayButton label="Reset View" onClick={onResetView} />
          <OverlayButton label="Clear Trail" onClick={onClearTrail} />
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-3 px-4 py-4">
        <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface)]/88 px-3 py-2 text-[0.72rem] leading-6 text-[var(--text-muted)] backdrop-blur-sm">
          <div>Zoom {Math.round(viewport.zoomPxPerMm * 1000)} px/m</div>
          <div>Trail {trail.length} pts</div>
        </div>

        <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface)]/88 px-3 py-2 text-right text-[0.72rem] leading-6 text-[var(--text-muted)] backdrop-blur-sm">
          <div>{poseSelection.selectedSourceLabel}</div>
          <div>{poseSelection.isRenderable ? `${poseSelection.pose.frame} frame` : 'No valid pose selected'}</div>
        </div>
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
