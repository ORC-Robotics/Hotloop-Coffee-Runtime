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

export interface PlanarSceneModel {
  widthPx: number
  heightPx: number
  viewport: PlanarSceneViewport
  palette: PlanarScenePalette
  trail: PlanarSceneTrailPoint[]
  pose: PlanarScenePose | null
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
  drawTrail(ctx, scene)

  if (scene.pose) {
    drawRobotBody(ctx, scene, scene.pose)
    drawHeadingMarker(ctx, scene, scene.pose)
  }

  ctx.restore()
}
