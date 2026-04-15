import type { PlanarPoseFreshness } from '../../types/telemetry'

const GRID_MAJOR_STEPS_MM = [50, 100, 200, 250, 500, 1000, 2000, 5000, 10000] as const

export interface PlanarScenePalette {
  background: string
  surface: string
  gridMinor: string
  gridMajor: string
  axisX: string
  axisY: string
  axisOrigin: string
  trail: string
  robotFill: string
  robotStroke: string
  heading: string
  lidarSweep: string
  lidarPoint: string
  lidarGhost: string
  observedMapPoint: string
  observedMapRecent: string
  occupancyFree: string
  occupancyOccupied: string
  occupancyMixed: string
  goalReady: string
  goalArmed: string
  goalBlocked: string
  registrationSweep: string
  registrationPoint: string
}

export interface PlanarSceneViewport {
  centerXMm: number
  centerYMm: number
  zoomPxPerMm: number
}

export interface PlanarSceneTrailPoint {
  xMm: number
  yMm: number
  yawDeg: number
  timestampMs: number
  frame: string
  source: string
}

export interface PlanarScenePose {
  xMm: number
  yMm: number
  yawDeg: number
  freshness: PlanarPoseFreshness
  frame: string
  source: string
}

export interface PlanarSceneLidarPoint {
  xMm: number
  yMm: number
  angleDeg: number
  distanceMm: number
}

export interface PlanarSceneLidar {
  freshness: PlanarPoseFreshness
  frame: string
  poseFrame: string
  points: PlanarSceneLidarPoint[]
}

export interface PlanarSceneBufferedLidar {
  freshness: PlanarPoseFreshness
  frame: string
  poseFrame: string
  pose: PlanarScenePose
  points: PlanarSceneLidarPoint[]
}

export interface PlanarSceneObservedMapPoint {
  xMm: number
  yMm: number
}

export interface PlanarSceneObservedMapScan {
  timestampMs: number
  sequence: number
  frame: string
  pointCount: number
  points: PlanarSceneObservedMapPoint[]
}

export interface PlanarSceneObservedMap {
  frame: string
  fadeOlderScans: boolean
  scans: PlanarSceneObservedMapScan[]
}

export interface PlanarSceneOccupancyCell {
  centerXMm: number
  centerYMm: number
  freeCount: number
  occupiedCount: number
  state: 'free' | 'occupied' | 'mixed'
  confidence: number
}

export interface PlanarSceneOccupancyLayer {
  frame: string
  cellSizeMm: number
  cells: PlanarSceneOccupancyCell[]
}

export type PlanarSceneGoalPreviewStatus = 'ready' | 'armed' | 'blocked' | 'unreachable'

export interface PlanarSceneGoalPreviewPoint {
  xMm: number
  yMm: number
}

export interface PlanarSceneGoalPreview {
  status: PlanarSceneGoalPreviewStatus
  requestedXMm: number
  requestedYMm: number
  targetXMm: number | null
  targetYMm: number | null
  path: PlanarSceneGoalPreviewPoint[]
}

export type PlanarSceneRegistrationQuality = 'good' | 'fair' | 'poor' | 'insufficient'

export interface PlanarSceneRegistration {
  quality: PlanarSceneRegistrationQuality
  points: PlanarSceneLidarPoint[]
}

export interface PlanarSceneModel {
  widthPx: number
  heightPx: number
  viewport: PlanarSceneViewport
  palette: PlanarScenePalette
  trail: PlanarSceneTrailPoint[]
  pose: PlanarScenePose | null
  observedMap: PlanarSceneObservedMap | null
  occupancy: PlanarSceneOccupancyLayer | null
  goalPreview: PlanarSceneGoalPreview | null
  lidarHistory: PlanarSceneBufferedLidar[]
  lidar: PlanarSceneLidar | null
  registration: PlanarSceneRegistration | null
}

function worldToScreen(
  xMm: number,
  yMm: number,
  viewport: PlanarSceneViewport,
  widthPx: number,
  heightPx: number,
) {
  return {
    x: widthPx / 2 + (xMm - viewport.centerXMm) * viewport.zoomPxPerMm,
    y: heightPx / 2 - (yMm - viewport.centerYMm) * viewport.zoomPxPerMm,
  }
}

function robotLocalToWorld(
  pose: PlanarScenePose,
  localXMm: number,
  localYMm: number,
) {
  const headingRad = (pose.yawDeg * Math.PI) / 180

  return {
    xMm: pose.xMm + localXMm * Math.cos(headingRad) + localYMm * Math.sin(headingRad),
    yMm: pose.yMm + localYMm * Math.cos(headingRad) - localXMm * Math.sin(headingRad),
  }
}

function chooseMajorGridStepMm(zoomPxPerMm: number) {
  for (const stepMm of GRID_MAJOR_STEPS_MM) {
    if (stepMm * zoomPxPerMm >= 88) {
      return stepMm
    }
  }

  return GRID_MAJOR_STEPS_MM[GRID_MAJOR_STEPS_MM.length - 1]
}

function drawGrid(ctx: CanvasRenderingContext2D, scene: PlanarSceneModel) {
  const { widthPx, heightPx, viewport, palette } = scene
  const majorStepMm = chooseMajorGridStepMm(viewport.zoomPxPerMm)
  const minorStepMm = majorStepMm / 5
  const leftMm = viewport.centerXMm - widthPx / (2 * viewport.zoomPxPerMm)
  const rightMm = viewport.centerXMm + widthPx / (2 * viewport.zoomPxPerMm)
  const bottomMm = viewport.centerYMm - heightPx / (2 * viewport.zoomPxPerMm)
  const topMm = viewport.centerYMm + heightPx / (2 * viewport.zoomPxPerMm)

  ctx.save()
  ctx.lineWidth = 1
  ctx.strokeStyle = palette.gridMinor
  ctx.globalAlpha = 0.52
  ctx.beginPath()

  for (
    let xMm = Math.floor(leftMm / minorStepMm) * minorStepMm;
    xMm <= rightMm;
    xMm += minorStepMm
  ) {
    const screen = worldToScreen(xMm, viewport.centerYMm, viewport, widthPx, heightPx)
    ctx.moveTo(screen.x, 0)
    ctx.lineTo(screen.x, heightPx)
  }

  for (
    let yMm = Math.floor(bottomMm / minorStepMm) * minorStepMm;
    yMm <= topMm;
    yMm += minorStepMm
  ) {
    const screen = worldToScreen(viewport.centerXMm, yMm, viewport, widthPx, heightPx)
    ctx.moveTo(0, screen.y)
    ctx.lineTo(widthPx, screen.y)
  }

  ctx.stroke()
  ctx.strokeStyle = palette.gridMajor
  ctx.globalAlpha = 0.8
  ctx.beginPath()

  for (
    let xMm = Math.floor(leftMm / majorStepMm) * majorStepMm;
    xMm <= rightMm;
    xMm += majorStepMm
  ) {
    const screen = worldToScreen(xMm, viewport.centerYMm, viewport, widthPx, heightPx)
    ctx.moveTo(screen.x, 0)
    ctx.lineTo(screen.x, heightPx)
  }

  for (
    let yMm = Math.floor(bottomMm / majorStepMm) * majorStepMm;
    yMm <= topMm;
    yMm += majorStepMm
  ) {
    const screen = worldToScreen(viewport.centerXMm, yMm, viewport, widthPx, heightPx)
    ctx.moveTo(0, screen.y)
    ctx.lineTo(widthPx, screen.y)
  }

  ctx.stroke()
  ctx.restore()
}

function drawAxes(ctx: CanvasRenderingContext2D, scene: PlanarSceneModel) {
  const { widthPx, heightPx, viewport, palette } = scene
  const originScreen = worldToScreen(0, 0, viewport, widthPx, heightPx)

  ctx.save()
  ctx.lineWidth = 1.35
  ctx.globalAlpha = 0.95

  ctx.strokeStyle = palette.axisX
  ctx.beginPath()
  ctx.moveTo(0, originScreen.y)
  ctx.lineTo(widthPx, originScreen.y)
  ctx.stroke()

  ctx.strokeStyle = palette.axisY
  ctx.beginPath()
  ctx.moveTo(originScreen.x, 0)
  ctx.lineTo(originScreen.x, heightPx)
  ctx.stroke()

  ctx.fillStyle = palette.axisOrigin
  ctx.beginPath()
  ctx.arc(originScreen.x, originScreen.y, 4.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawTrail(ctx: CanvasRenderingContext2D, scene: PlanarSceneModel) {
  if (scene.trail.length === 0) {
    return
  }

  ctx.save()
  ctx.strokeStyle = scene.palette.trail
  ctx.lineWidth = 2.4
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.globalAlpha = 0.92
  ctx.beginPath()

  scene.trail.forEach((point, index) => {
    const screen = worldToScreen(point.xMm, point.yMm, scene.viewport, scene.widthPx, scene.heightPx)

    if (index === 0) {
      ctx.moveTo(screen.x, screen.y)
      return
    }

    ctx.lineTo(screen.x, screen.y)
  })

  ctx.stroke()

  const latestPoint = scene.trail[scene.trail.length - 1]
  const latestScreen = worldToScreen(
    latestPoint.xMm,
    latestPoint.yMm,
    scene.viewport,
    scene.widthPx,
    scene.heightPx,
  )
  ctx.fillStyle = scene.palette.trail
  ctx.beginPath()
  ctx.arc(latestScreen.x, latestScreen.y, 3.25, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawObservedMap(ctx: CanvasRenderingContext2D, scene: PlanarSceneModel) {
  if (!scene.observedMap || scene.observedMap.scans.length === 0) {
    return
  }

  const totalScans = scene.observedMap.scans.length

  ctx.save()

  scene.observedMap.scans.forEach((scan, index) => {
    const ageRatio = totalScans <= 1 ? 1 : (index + 1) / totalScans
    const opacity = scene.observedMap.fadeOlderScans ? 0.08 + ageRatio * 0.48 : 0.32
    const pointRadius = scene.observedMap.fadeOlderScans ? 1.05 + ageRatio * 0.85 : 1.7

    ctx.fillStyle =
      index === totalScans - 1 ? scene.palette.observedMapRecent : scene.palette.observedMapPoint
    ctx.globalAlpha = opacity

    scan.points.forEach((point) => {
      const screen = worldToScreen(point.xMm, point.yMm, scene.viewport, scene.widthPx, scene.heightPx)
      ctx.beginPath()
      ctx.arc(screen.x, screen.y, pointRadius, 0, Math.PI * 2)
      ctx.fill()
    })
  })

  ctx.restore()
}

function drawOccupancyLayer(ctx: CanvasRenderingContext2D, scene: PlanarSceneModel) {
  if (!scene.occupancy || scene.occupancy.cells.length === 0) {
    return
  }

  const cellSizePx = scene.occupancy.cellSizeMm * scene.viewport.zoomPxPerMm
  if (cellSizePx <= 0.5) {
    return
  }

  const halfCellPx = cellSizePx / 2
  const shouldStroke = cellSizePx >= 14

  ctx.save()
  ctx.lineWidth = 1

  scene.occupancy.cells.forEach((cell) => {
    const screen = worldToScreen(
      cell.centerXMm,
      cell.centerYMm,
      scene.viewport,
      scene.widthPx,
      scene.heightPx,
    )
    const alpha =
      cell.state === 'occupied'
        ? 0.18 + cell.confidence * 0.38
        : cell.state === 'free'
          ? 0.08 + cell.confidence * 0.18
          : 0.12 + cell.confidence * 0.26

    ctx.globalAlpha = alpha
    ctx.fillStyle =
      cell.state === 'occupied'
        ? scene.palette.occupancyOccupied
        : cell.state === 'free'
          ? scene.palette.occupancyFree
          : scene.palette.occupancyMixed
    ctx.fillRect(screen.x - halfCellPx, screen.y - halfCellPx, cellSizePx, cellSizePx)

    if (shouldStroke) {
      ctx.globalAlpha = Math.min(0.5, alpha + 0.08)
      ctx.strokeStyle = scene.palette.gridMinor
      ctx.strokeRect(screen.x - halfCellPx, screen.y - halfCellPx, cellSizePx, cellSizePx)
    }
  })

  ctx.restore()
}

function drawGoalPreview(ctx: CanvasRenderingContext2D, scene: PlanarSceneModel) {
  if (!scene.goalPreview) {
    return
  }

  const preview = scene.goalPreview
  const targetXMm = preview.targetXMm ?? preview.requestedXMm
  const targetYMm = preview.targetYMm ?? preview.requestedYMm
  const targetScreen = worldToScreen(
    targetXMm,
    targetYMm,
    scene.viewport,
    scene.widthPx,
    scene.heightPx,
  )
  const requestedScreen = worldToScreen(
    preview.requestedXMm,
    preview.requestedYMm,
    scene.viewport,
    scene.widthPx,
    scene.heightPx,
  )
  const accent =
    preview.status === 'armed'
      ? scene.palette.goalArmed
      : preview.status === 'ready'
        ? scene.palette.goalReady
        : scene.palette.goalBlocked

  ctx.save()

  if (preview.path.length >= 2) {
    ctx.strokeStyle = accent
    ctx.lineWidth = 2.2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.setLineDash(preview.status === 'armed' ? [] : [10, 8])
    ctx.globalAlpha = preview.status === 'armed' ? 0.92 : 0.76
    ctx.beginPath()

    preview.path.forEach((point, index) => {
      const screen = worldToScreen(point.xMm, point.yMm, scene.viewport, scene.widthPx, scene.heightPx)
      if (index === 0) {
        ctx.moveTo(screen.x, screen.y)
        return
      }

      ctx.lineTo(screen.x, screen.y)
    })

    ctx.stroke()
    ctx.setLineDash([])
  }

  if (
    preview.targetXMm !== null &&
    preview.targetYMm !== null &&
    (preview.targetXMm !== preview.requestedXMm || preview.targetYMm !== preview.requestedYMm)
  ) {
    ctx.strokeStyle = accent
    ctx.lineWidth = 1.2
    ctx.setLineDash([4, 6])
    ctx.globalAlpha = 0.5
    ctx.beginPath()
    ctx.moveTo(requestedScreen.x, requestedScreen.y)
    ctx.lineTo(targetScreen.x, targetScreen.y)
    ctx.stroke()
    ctx.setLineDash([])
  }

  ctx.strokeStyle = accent
  ctx.lineWidth = 2
  ctx.globalAlpha = 0.95
  ctx.beginPath()
  ctx.arc(targetScreen.x, targetScreen.y, 11, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(targetScreen.x, targetScreen.y, 4, 0, Math.PI * 2)
  ctx.fillStyle = accent
  ctx.fill()

  ctx.beginPath()
  ctx.moveTo(targetScreen.x - 16, targetScreen.y)
  ctx.lineTo(targetScreen.x + 16, targetScreen.y)
  ctx.moveTo(targetScreen.x, targetScreen.y - 16)
  ctx.lineTo(targetScreen.x, targetScreen.y + 16)
  ctx.stroke()

  if (preview.targetXMm !== null && preview.targetYMm !== null) {
    ctx.globalAlpha = 0.72
    ctx.fillStyle = accent
    ctx.beginPath()
    ctx.arc(requestedScreen.x, requestedScreen.y, 3, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.restore()
}

function drawLidarScan(
  ctx: CanvasRenderingContext2D,
  scene: PlanarSceneModel,
  pose: PlanarScenePose,
  lidar: PlanarSceneLidar,
  opacityScale = 1,
  pointRadius = 2.3,
) {
  if (lidar.points.length === 0) {
    return
  }

  ctx.save()
  ctx.strokeStyle = scene.palette.lidarSweep
  ctx.fillStyle =
    lidar.freshness === 'stale' ? scene.palette.lidarGhost : scene.palette.lidarPoint
  ctx.lineWidth = 1.75
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.globalAlpha = (lidar.freshness === 'stale' ? 0.44 : 0.84) * opacityScale
  ctx.beginPath()

  lidar.points.forEach((point, index) => {
    const world = robotLocalToWorld(pose, point.xMm, point.yMm)
    const screen = worldToScreen(world.xMm, world.yMm, scene.viewport, scene.widthPx, scene.heightPx)

    if (index === 0) {
      ctx.moveTo(screen.x, screen.y)
      return
    }

    ctx.lineTo(screen.x, screen.y)
  })

  ctx.stroke()

  lidar.points.forEach((point) => {
    const world = robotLocalToWorld(pose, point.xMm, point.yMm)
    const screen = worldToScreen(world.xMm, world.yMm, scene.viewport, scene.widthPx, scene.heightPx)
    ctx.beginPath()
    ctx.arc(screen.x, screen.y, pointRadius, 0, Math.PI * 2)
    ctx.fill()
  })

  ctx.restore()
}

function drawLidarHistory(ctx: CanvasRenderingContext2D, scene: PlanarSceneModel) {
  if (scene.lidarHistory.length === 0) {
    return
  }

  scene.lidarHistory.forEach((historyScan, index) => {
    const opacityScale = 0.14 + ((index + 1) / scene.lidarHistory.length) * 0.28

    drawLidarScan(
      ctx,
      scene,
      historyScan.pose,
      {
        freshness: historyScan.freshness,
        frame: historyScan.frame,
        poseFrame: historyScan.poseFrame,
        points: historyScan.points,
      },
      opacityScale,
      1.8,
    )
  })
}

function drawRegistrationOverlay(
  ctx: CanvasRenderingContext2D,
  scene: PlanarSceneModel,
  pose: PlanarScenePose,
  registration: PlanarSceneRegistration,
) {
  if (registration.points.length === 0) {
    return
  }

  const opacityScale =
    registration.quality === 'good'
      ? 0.62
      : registration.quality === 'fair'
        ? 0.5
        : 0.4

  ctx.save()
  ctx.strokeStyle = scene.palette.registrationSweep
  ctx.fillStyle = scene.palette.registrationPoint
  ctx.lineWidth = 1.4
  ctx.globalAlpha = opacityScale
  ctx.beginPath()

  registration.points.forEach((point, index) => {
    const world = robotLocalToWorld(pose, point.xMm, point.yMm)
    const screen = worldToScreen(world.xMm, world.yMm, scene.viewport, scene.widthPx, scene.heightPx)

    if (index === 0) {
      ctx.moveTo(screen.x, screen.y)
      return
    }

    ctx.lineTo(screen.x, screen.y)
  })

  ctx.stroke()

  registration.points.forEach((point) => {
    const world = robotLocalToWorld(pose, point.xMm, point.yMm)
    const screen = worldToScreen(world.xMm, world.yMm, scene.viewport, scene.widthPx, scene.heightPx)
    ctx.beginPath()
    ctx.arc(screen.x, screen.y, 2, 0, Math.PI * 2)
    ctx.fill()
  })

  ctx.restore()
}

function drawRobotBody(ctx: CanvasRenderingContext2D, scene: PlanarSceneModel, pose: PlanarScenePose) {
  const bodyPoints = [
    { xMm: 0, yMm: 220 },
    { xMm: 150, yMm: 86 },
    { xMm: 142, yMm: -178 },
    { xMm: -142, yMm: -178 },
    { xMm: -150, yMm: 86 },
  ]

  ctx.save()
  ctx.fillStyle = scene.palette.robotFill
  ctx.strokeStyle = scene.palette.robotStroke
  ctx.globalAlpha = pose.freshness === 'stale' ? 0.72 : 0.96
  ctx.lineWidth = 2.2
  ctx.lineJoin = 'round'
  ctx.beginPath()

  bodyPoints.forEach((point, index) => {
    const world = robotLocalToWorld(pose, point.xMm, point.yMm)
    const screen = worldToScreen(world.xMm, world.yMm, scene.viewport, scene.widthPx, scene.heightPx)

    if (index === 0) {
      ctx.moveTo(screen.x, screen.y)
      return
    }

    ctx.lineTo(screen.x, screen.y)
  })

  ctx.closePath()
  ctx.fill()
  ctx.stroke()

  const centerScreen = worldToScreen(pose.xMm, pose.yMm, scene.viewport, scene.widthPx, scene.heightPx)
  ctx.fillStyle = scene.palette.robotStroke
  ctx.beginPath()
  ctx.arc(centerScreen.x, centerScreen.y, 4, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawHeadingMarker(ctx: CanvasRenderingContext2D, scene: PlanarSceneModel, pose: PlanarScenePose) {
  const arrowTip = robotLocalToWorld(pose, 0, 300)
  const arrowLeft = robotLocalToWorld(pose, -40, 240)
  const arrowRight = robotLocalToWorld(pose, 40, 240)
  const center = worldToScreen(pose.xMm, pose.yMm, scene.viewport, scene.widthPx, scene.heightPx)
  const tip = worldToScreen(arrowTip.xMm, arrowTip.yMm, scene.viewport, scene.widthPx, scene.heightPx)
  const left = worldToScreen(arrowLeft.xMm, arrowLeft.yMm, scene.viewport, scene.widthPx, scene.heightPx)
  const right = worldToScreen(arrowRight.xMm, arrowRight.yMm, scene.viewport, scene.widthPx, scene.heightPx)

  ctx.save()
  ctx.strokeStyle = scene.palette.heading
  ctx.fillStyle = scene.palette.heading
  ctx.lineWidth = 2.4
  ctx.lineCap = 'round'
  ctx.globalAlpha = pose.freshness === 'stale' ? 0.68 : 1
  ctx.beginPath()
  ctx.moveTo(center.x, center.y)
  ctx.lineTo(tip.x, tip.y)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(tip.x, tip.y)
  ctx.lineTo(left.x, left.y)
  ctx.lineTo(right.x, right.y)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

export function drawPlanarScene(ctx: CanvasRenderingContext2D, scene: PlanarSceneModel) {
  ctx.save()
  ctx.clearRect(0, 0, scene.widthPx, scene.heightPx)
  ctx.fillStyle = scene.palette.background
  ctx.fillRect(0, 0, scene.widthPx, scene.heightPx)

  drawGrid(ctx, scene)
  drawAxes(ctx, scene)
  drawOccupancyLayer(ctx, scene)
  drawObservedMap(ctx, scene)
  drawGoalPreview(ctx, scene)

  if (scene.pose) {
    drawLidarHistory(ctx, scene)

    if (scene.registration) {
      drawRegistrationOverlay(ctx, scene, scene.pose, scene.registration)
    }

    if (scene.lidar) {
      drawLidarScan(ctx, scene, scene.pose, scene.lidar)
    }

    drawTrail(ctx, scene)
    drawRobotBody(ctx, scene, scene.pose)
    drawHeadingMarker(ctx, scene, scene.pose)
  } else {
    drawTrail(ctx, scene)
  }

  ctx.restore()
}
