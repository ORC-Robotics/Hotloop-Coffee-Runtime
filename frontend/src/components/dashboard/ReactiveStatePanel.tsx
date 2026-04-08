import { clamp, formatCommand, formatDegrees } from '../../lib/format'
import type {
  CommandData,
  HeadingData,
  PerceptionData,
  ReactiveStateData,
  SystemHealthData,
  TelemetryDerivedState,
  UiTone,
} from '../../types/telemetry'
import { DashboardCard } from './DashboardCard'
import { StatusBadge } from './StatusBadge'

interface ReactiveStatePanelProps {
  online: boolean
  heading: HeadingData
  perception: PerceptionData
  commands: CommandData
  systems: SystemHealthData
  data: ReactiveStateData
  derived: TelemetryDerivedState
}

type SignalSource = 'live' | 'inferred' | 'unavailable'

function toRadians(angleDeg: number) {
  return (angleDeg * Math.PI) / 180
}

function polarPoint(centerX: number, centerY: number, length: number, angleDeg: number) {
  const radians = toRadians(angleDeg - 90)
  return {
    x: centerX + Math.cos(radians) * length,
    y: centerY + Math.sin(radians) * length,
  }
}

function describeTurnBias(data: ReactiveStateData, perception: PerceptionData, heading: HeadingData) {
  const pendingDirection = (data.pendingTurnDirection ?? '').toLowerCase()
  const lastTurn = data.lastTurn.toLowerCase()

  if (pendingDirection.includes('left')) return 'left'
  if (pendingDirection.includes('right')) return 'right'
  if (lastTurn.includes('left')) return 'left'
  if (lastTurn.includes('right')) return 'right'
  if (perception.leftOpenFlag && !perception.rightOpenFlag) return 'left'
  if (perception.rightOpenFlag && !perception.leftOpenFlag) return 'right'
  if (heading.angularErrorDeg < -5) return 'left'
  if (heading.angularErrorDeg > 5) return 'right'
  return 'center'
}

function resolveTurnSignal(
  online: boolean,
  value: boolean | null,
  inferredValue: boolean,
): { value: boolean | null; source: SignalSource } {
  if (!online) {
    return { value: null, source: 'unavailable' }
  }

  if (value === true || value === false) {
    return { value, source: 'live' }
  }

  return { value: inferredValue, source: 'inferred' }
}

function resolvePendingTurnDirection(
  online: boolean,
  direction: string | null,
  inferredDirection: string,
): { value: string | null; source: SignalSource } {
  if (!online) {
    return { value: null, source: 'unavailable' }
  }

  if (direction && direction.trim().length > 0) {
    return { value: direction, source: 'live' }
  }

  return { value: inferredDirection, source: 'inferred' }
}

function signalTone(value: boolean | null, preferred: UiTone): UiTone {
  if (value === null) return 'neutral'
  return value ? preferred : 'neutral'
}

function signalLabel(value: boolean | null, trueLabel: string, falseLabel: string) {
  if (value === null) return 'unavailable'
  return value ? trueLabel : falseLabel
}

function sourceLabel(source: SignalSource) {
  if (source === 'live') return 'live'
  if (source === 'inferred') return 'inferred'
  return 'unavailable'
}

function normalizePendingTurnDirection(value: string | null) {
  if (!value) {
    return 'NONE'
  }

  return value.trim().toUpperCase()
}

function rotationSweep(rotation: number) {
  return clamp(rotation, -1, 1) * 84
}

function buildRotationArcPath(centerX: number, centerY: number, radius: number, rotation: number) {
  const sweep = rotationSweep(rotation)
  if (Math.abs(sweep) < 4) {
    return null
  }

  const startAngle = rotation >= 0 ? -90 : -90 + sweep
  const endAngle = rotation >= 0 ? -90 + sweep : -90
  const start = polarPoint(centerX, centerY, radius, startAngle)
  const end = polarPoint(centerX, centerY, radius, endAngle)
  const largeArcFlag = Math.abs(sweep) > 180 ? 1 : 0
  const sweepFlag = rotation >= 0 ? 1 : 0

  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} ${sweepFlag} ${end.x} ${end.y}`
}

function headingTone(errorDeg: number): UiTone {
  if (Math.abs(errorDeg) > 20) return 'critical'
  if (Math.abs(errorDeg) > 8) return 'warning'
  return 'good'
}

function commandIntentLabel(forward: number, rotation: number) {
  if (Math.abs(rotation) > 0.55 && Math.abs(forward) < 0.12) {
    return rotation > 0 ? 'pivot right' : 'pivot left'
  }
  if (Math.abs(rotation) > 0.28) {
    return rotation > 0 ? 'advance + rotate right' : 'advance + rotate left'
  }
  if (forward > 0.2) {
    return 'advance'
  }
  return 'hold'
}

function lateralIntentLabel(center: number) {
  if (center > 0.08) return 'translate right'
  if (center < -0.08) return 'translate left'
  return 'no lateral shift'
}

function rotationIntentLabel(rotation: number) {
  if (rotation > 0.08) return 'rotate right'
  if (rotation < -0.08) return 'rotate left'
  return 'no rotation'
}

export function ReactiveStatePanel({
  online,
  heading,
  perception,
  commands,
  systems,
  data,
  derived,
}: ReactiveStatePanelProps) {
  const turnBias = describeTurnBias(data, perception, heading)
  const inferredPendingDirection =
    turnBias === 'left' && (perception.leftOpenFlag || Math.abs(commands.rotation) > 0.26)
      ? 'LEFT'
      : turnBias === 'right' && (perception.rightOpenFlag || Math.abs(commands.rotation) > 0.26)
        ? 'RIGHT'
        : 'NONE'
  const pendingDirection = resolvePendingTurnDirection(
    online,
    data.pendingTurnDirection,
    inferredPendingDirection,
  )
  const normalizedPendingDirection = normalizePendingTurnDirection(pendingDirection.value)
  const detected = resolveTurnSignal(
    online,
    data.turnDetected,
    perception.leftOpenFlag || perception.rightOpenFlag,
  )
  const pending = resolveTurnSignal(
    online,
    data.pendingTurnArmed,
    detected.value === true &&
      (normalizedPendingDirection !== 'NONE' ||
        Math.abs(commands.rotation) > 0.26 ||
        /decision|turn|entry|recover/i.test(`${data.state} ${data.decision}`)),
  )
  const executable = resolveTurnSignal(
    online,
    data.turnExecutable,
    detected.value === true && !perception.frontBlocked && !perception.deadEnd && systems.validScan,
  )

  const width = 640
  const height = 220
  const centerX = width / 2
  const robotY = 156
  const robotWidth = 46
  const robotHeight = 54
  const frontRange = clamp(perception.frontMedianMm / 1700, 0.08, 1)
  const leftRange = clamp(perception.leftWallMm / 1200, 0.08, 1)
  const rightRange = clamp(perception.rightWallMm / 1200, 0.08, 1)
  const leftOpenRange = clamp(perception.leftOpenMm / 1800, 0.05, 1)
  const rightOpenRange = clamp(perception.rightOpenMm / 1800, 0.05, 1)
  const frontDepth = 44 + frontRange * 68
  const leftWallX = centerX - (64 + leftRange * 82)
  const rightWallX = centerX + (64 + rightRange * 82)
  const corridorTopY = robotY - frontDepth - 16
  const desiredVector = {
    x: clamp(commands.center, -1, 1) * 88,
    y: -18 - clamp(commands.forward, -1, 1) * 88,
  }
  const desiredEnd = {
    x: centerX + desiredVector.x,
    y: robotY + desiredVector.y,
  }
  const desiredHeadingEnd = polarPoint(
    centerX,
    robotY - 14,
    82,
    clamp(heading.angularErrorDeg, -78, 78),
  )
  const currentHeadingEnd = polarPoint(centerX, robotY - 14, 64, 0)
  const rotationPath = buildRotationArcPath(centerX, robotY - 14, 48, commands.rotation)
  const arcTip = rotationPath
    ? polarPoint(centerX, robotY - 14, 48, commands.rotation >= 0 ? -6 + rotationSweep(commands.rotation) : -174 + rotationSweep(commands.rotation))
    : null
  const headerTone = executable.value ? 'good' : pending.value ? 'warning' : detected.value ? 'info' : 'neutral'
  const angleTone = headingTone(heading.angularErrorDeg)
  const frontStateLabel = perception.frontBlocked
    ? 'front blocked'
    : perception.frontSlow
      ? 'front caution'
      : 'front clear'
  const turnStateLabel =
    normalizedPendingDirection !== 'NONE' && executable.value
      ? `${normalizedPendingDirection} ready`
      : normalizedPendingDirection !== 'NONE' && pending.value
        ? `${normalizedPendingDirection} armed`
        : detected.value
          ? 'opening detected'
          : 'no pending turn'
  const motionStateLabel = commandIntentLabel(commands.forward, commands.rotation)
  const lateralStateLabel = lateralIntentLabel(commands.center)
  const rotationStateLabel = rotationIntentLabel(commands.rotation)
  const statusItems = [
    {
      label: 'Turn detected',
      value: signalLabel(detected.value, 'yes', 'no'),
      source: sourceLabel(detected.source),
      tone: signalTone(detected.value, 'info'),
    },
    {
      label: 'Pending turn',
      value:
        pending.value === null
          ? 'unavailable'
          : normalizedPendingDirection === 'NONE'
            ? 'none'
            : normalizedPendingDirection,
      source:
        pending.source === 'live' || pendingDirection.source === 'live'
          ? 'live'
          : pending.source === 'inferred' || pendingDirection.source === 'inferred'
            ? 'inferred'
            : 'unavailable',
      tone:
        pending.value === null
          ? 'neutral'
          : normalizedPendingDirection === 'NONE'
            ? 'neutral'
            : 'warning',
    },
    {
      label: 'Turn executable',
      value: signalLabel(executable.value, 'ready', 'hold'),
      source: sourceLabel(executable.source),
      tone: signalTone(executable.value, 'good'),
    },
  ] as const

  return (
    <DashboardCard
      title="Intent / Decision"
      subtitle="local robot frame"
      accent="accent"
      className="min-h-[0]"
      headerSlot={<StatusBadge tone={headerTone} label={executable.value ? 'turn ready' : pending.value ? 'turn armed' : 'monitoring'} />}
    >
      <div className="flex h-full flex-col gap-2.5">
        <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface-alt)]/82 p-2.5">
          <svg viewBox={`0 0 ${width} ${height}`} className="h-[220px] w-full">
              {Array.from({ length: 7 }, (_, index) => (
                <line
                  key={`ring-${index}`}
                  x1={centerX - (66 + index * 34)}
                  y1={robotY - (index * 24)}
                  x2={centerX + (66 + index * 34)}
                  y2={robotY - (index * 24)}
                  stroke="var(--gridLine)"
                  strokeWidth="1"
                  opacity="0.62"
                />
              ))}

              <polygon
                points={`${centerX - 126},${corridorTopY} ${centerX + 126},${corridorTopY} ${rightWallX},${robotY + 26} ${leftWallX},${robotY + 26}`}
                fill="color-mix(in srgb, var(--info) 8%, transparent)"
                stroke="var(--border-strong)"
                strokeWidth="1.8"
              />

              <polygon
                points={`${centerX},${robotY - 16} ${centerX - (46 + leftOpenRange * 88)},${robotY - 30} ${centerX - (78 + leftOpenRange * 118)},${robotY - 76} ${centerX - 12},${robotY - 74}`}
                fill={normalizedPendingDirection === 'LEFT' ? 'color-mix(in srgb, var(--warning) 22%, transparent)' : perception.leftOpenFlag ? 'color-mix(in srgb, var(--warning) 18%, transparent)' : 'transparent'}
                stroke={normalizedPendingDirection === 'LEFT' ? 'var(--warning)' : perception.leftOpenFlag ? 'var(--warning)' : 'var(--border)'}
                strokeWidth="1.3"
                opacity={normalizedPendingDirection === 'LEFT' || perception.leftOpenFlag ? 0.9 : 0.42}
              />
              <polygon
                points={`${centerX},${robotY - 16} ${centerX + (46 + rightOpenRange * 88)},${robotY - 30} ${centerX + (78 + rightOpenRange * 118)},${robotY - 76} ${centerX + 12},${robotY - 74}`}
                fill={normalizedPendingDirection === 'RIGHT' ? 'color-mix(in srgb, var(--warning) 22%, transparent)' : perception.rightOpenFlag ? 'color-mix(in srgb, var(--warning) 18%, transparent)' : 'transparent'}
                stroke={normalizedPendingDirection === 'RIGHT' ? 'var(--warning)' : perception.rightOpenFlag ? 'var(--warning)' : 'var(--border)'}
                strokeWidth="1.3"
                opacity={normalizedPendingDirection === 'RIGHT' || perception.rightOpenFlag ? 0.9 : 0.42}
              />

              <line
                x1={centerX}
                y1={robotY - 14}
                x2={currentHeadingEnd.x}
                y2={currentHeadingEnd.y}
                stroke="var(--text)"
                strokeWidth="3.4"
                strokeLinecap="round"
              />
              <line
                x1={centerX}
                y1={robotY - 14}
                x2={desiredHeadingEnd.x}
                y2={desiredHeadingEnd.y}
                stroke="var(--danger)"
                strokeWidth="3.8"
                strokeLinecap="round"
              />
              <line
                x1={centerX}
                y1={robotY - 14}
                x2={desiredEnd.x}
                y2={desiredEnd.y}
                stroke="var(--primary)"
                strokeWidth="5"
                strokeLinecap="round"
              />

              {rotationPath ? (
                <>
                  <path d={rotationPath} fill="none" stroke="var(--danger)" strokeWidth="4.4" strokeLinecap="round" />
                  {arcTip ? (
                    <polygon
                      points={
                        commands.rotation >= 0
                          ? `${arcTip.x},${arcTip.y} ${arcTip.x - 10},${arcTip.y + 6} ${arcTip.x - 1},${arcTip.y + 13}`
                          : `${arcTip.x},${arcTip.y} ${arcTip.x + 10},${arcTip.y + 6} ${arcTip.x + 1},${arcTip.y + 13}`
                      }
                      fill="var(--danger)"
                    />
                  ) : null}
                </>
              ) : null}

              <rect
                x={centerX - robotWidth / 2}
                y={robotY - robotHeight / 2}
                width={robotWidth}
                height={robotHeight}
                rx="14"
                fill="var(--surface-raised)"
                stroke="var(--text)"
                strokeWidth="2"
              />
              <line
                x1={centerX}
                y1={robotY - robotHeight / 2 + 6}
                x2={centerX}
                y2={robotY - robotHeight / 2 - 8}
                stroke="var(--text)"
                strokeWidth="3"
                strokeLinecap="round"
              />

              <text x={centerX} y={18} textAnchor="middle" fill="var(--text-muted)" fontSize="12" fontFamily="IBM Plex Mono, monospace">
                local intention frame
              </text>
              <text x={centerX} y={34} textAnchor="middle" fill="var(--danger)" fontSize="13" fontFamily="IBM Plex Mono, monospace">
                target {formatDegrees(heading.targetYawDeg, 1)} | err {formatDegrees(heading.angularErrorDeg, 1)}
              </text>
              <text x={centerX} y={52} textAnchor="middle" fill="var(--primary)" fontSize="13" fontFamily="IBM Plex Mono, monospace">
                {lateralStateLabel} | {rotationStateLabel}
              </text>
              <rect
                x="18"
                y="66"
                width="132"
                height="24"
                rx="12"
                fill={
                  perception.frontBlocked
                    ? 'color-mix(in srgb, var(--danger) 18%, var(--surface))'
                    : perception.frontSlow
                      ? 'color-mix(in srgb, var(--warning) 18%, var(--surface))'
                      : 'color-mix(in srgb, var(--success) 14%, var(--surface))'
                }
                stroke={
                  perception.frontBlocked
                    ? 'var(--danger)'
                    : perception.frontSlow
                      ? 'var(--warning)'
                      : 'var(--success)'
                }
                strokeWidth="1.2"
              />
              <text x="84" y="82" textAnchor="middle" fill="var(--text)" fontSize="12" fontFamily="IBM Plex Mono, monospace">
                {frontStateLabel}
              </text>
              <rect
                x="488"
                y="66"
                width="134"
                height="24"
                rx="12"
                fill={
                  executable.value
                    ? 'color-mix(in srgb, var(--success) 16%, var(--surface))'
                    : pending.value
                      ? 'color-mix(in srgb, var(--warning) 18%, var(--surface))'
                      : 'color-mix(in srgb, var(--info) 12%, var(--surface))'
                }
                stroke={
                  executable.value
                    ? 'var(--success)'
                    : pending.value
                      ? 'var(--warning)'
                      : 'var(--info)'
                }
                strokeWidth="1.2"
              />
              <text x="555" y="82" textAnchor="middle" fill="var(--text)" fontSize="12" fontFamily="IBM Plex Mono, monospace">
                {turnStateLabel}
              </text>
              <text x={centerX} y={robotY - 118} textAnchor="middle" fill="var(--text-muted)" fontSize="12" fontFamily="IBM Plex Mono, monospace">
                FORWARD
              </text>
              <text x={centerX - 162} y={robotY + 8} textAnchor="middle" fill="var(--text-muted)" fontSize="12" fontFamily="IBM Plex Mono, monospace">
                LEFT
              </text>
              <text x={centerX + 162} y={robotY + 8} textAnchor="middle" fill="var(--text-muted)" fontSize="12" fontFamily="IBM Plex Mono, monospace">
                RIGHT
              </text>
              <text x={leftWallX - 8} y={robotY + 16} textAnchor="end" fill="var(--primary)" fontSize="12" fontFamily="IBM Plex Mono, monospace">
                L wall
              </text>
              <text x={rightWallX + 8} y={robotY + 16} fill="var(--primary)" fontSize="12" fontFamily="IBM Plex Mono, monospace">
                R wall
              </text>
              <text x={centerX} y={corridorTopY - 8} textAnchor="middle" fill="var(--info)" fontSize="12" fontFamily="IBM Plex Mono, monospace">
                front window
              </text>
              <text x={centerX} y={robotY + 50} textAnchor="middle" fill="var(--primary)" fontSize="14" fontFamily="IBM Plex Mono, monospace">
                {motionStateLabel}
              </text>
              {normalizedPendingDirection === 'LEFT' ? (
                <text x={132} y={robotY - 102} textAnchor="middle" fill="var(--warning)" fontSize="14" fontWeight="700" fontFamily="IBM Plex Mono, monospace">
                  LEFT TURN
                </text>
              ) : null}
              {normalizedPendingDirection === 'RIGHT' ? (
                <text x={508} y={robotY - 102} textAnchor="middle" fill="var(--warning)" fontSize="14" fontWeight="700" fontFamily="IBM Plex Mono, monospace">
                  RIGHT TURN
                </text>
              ) : null}
          </svg>
        </div>

        <div className="grid gap-2 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <div className="rounded-[18px] border border-[var(--border)] bg-[var(--accent-soft)] px-3.5 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[0.64rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Current state</div>
              <StatusBadge tone={headerTone} label={turnStateLabel} />
            </div>
            <div className="mt-1.5 text-[1.02rem] font-semibold tracking-[-0.03em] text-[var(--text)]">{data.state}</div>
            <div className="mt-2 text-[0.8rem] leading-5 text-[var(--text-muted)]">{data.decision}</div>
            <div className="mt-2.5 grid gap-2 sm:grid-cols-3">
              {[
                ['Motion', motionStateLabel],
                ['Lateral', lateralStateLabel],
                ['Rotation', rotationStateLabel],
              ].map(([label, value]) => (
                <div key={label} className="rounded-[14px] border border-[var(--border)] bg-[var(--surface-alt)]/82 px-3 py-2">
                  <div className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">{label}</div>
                  <div className="mt-1 text-[0.82rem] text-[var(--text)]">{value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-2">
            {statusItems.map((item) => (
              <div
                key={item.label}
                className="rounded-[16px] border border-[var(--border)] bg-[var(--surface-alt)]/82 px-3 py-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[0.64rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                    {item.label}
                  </div>
                  <StatusBadge tone={item.tone} label={item.value} />
                </div>
                <div className="mt-1.5 text-[0.74rem] uppercase tracking-[0.14em] text-[var(--text-muted)]">
                  source {item.source}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ['Desired vector', `${formatCommand(commands.center)} | ${formatCommand(commands.forward)}`],
            ['Rotation cmd', formatCommand(commands.rotation)],
            ['Pending dir', normalizedPendingDirection],
            ['Drive control', data.driveControl],
          ].map(([label, value]) => (
            <div key={label} className="rounded-[16px] border border-[var(--border)] bg-[var(--surface-alt)]/82 px-3 py-2">
              <div className="text-[0.64rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">{label}</div>
              <div className="mt-1 text-[0.82rem] leading-5 text-[var(--text)]">{value}</div>
            </div>
          ))}
        </div>

        <div className="grid gap-2 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,0.6fr)_minmax(0,0.6fr)_minmax(0,0.6fr)]">
          <div className="rounded-[16px] border border-[var(--border)] bg-[var(--surface-alt)]/78 px-3 py-2">
            <div className="text-[0.64rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Planner narrative</div>
            <div className="mt-1 text-[0.76rem] leading-5 text-[var(--text-muted)]">{derived.stateNarrative}</div>
          </div>

          <div className="rounded-[16px] border border-[var(--border)] bg-[var(--surface-alt)]/78 px-3 py-2">
            <div className="text-[0.64rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Heading</div>
            <div className="mt-1 flex items-center gap-2">
              <StatusBadge tone={angleTone} label={Math.abs(heading.angularErrorDeg) > 8 ? 'correcting' : 'aligned'} />
            </div>
            <div className="mt-1 text-[0.76rem] font-mono text-[var(--text)]">{formatDegrees(heading.yawDeg, 1)}</div>
          </div>

          <div className="rounded-[16px] border border-[var(--border)] bg-[var(--surface-alt)]/78 px-3 py-2">
            <div className="text-[0.64rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Stable scans</div>
            <div className="mt-1 text-[0.92rem] font-mono text-[var(--text)]">{data.stableScans}</div>
          </div>

          <div className="rounded-[16px] border border-[var(--border)] bg-[var(--surface-alt)]/78 px-3 py-2">
            <div className="text-[0.64rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Last turn</div>
            <div className="mt-1 text-[0.82rem] text-[var(--text)]">{data.lastTurn}</div>
          </div>
        </div>
      </div>
    </DashboardCard>
  )
}
