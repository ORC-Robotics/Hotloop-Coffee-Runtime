import { clamp } from '../../lib/format'
import type { HeadingData, UiTone } from '../../types/telemetry'
import { DashboardCard } from './DashboardCard'
import { StatusBadge } from './StatusBadge'

interface HeadingPanelProps {
  data: HeadingData
  tone: UiTone
}

function polarPoint(cx: number, cy: number, radius: number, degrees: number) {
  const radians = ((degrees - 90) * Math.PI) / 180
  return {
    x: cx + Math.cos(radians) * radius,
    y: cy + Math.sin(radians) * radius,
  }
}

function angularTone(error: number): UiTone {
  const magnitude = Math.abs(error)
  if (magnitude > 18) return 'critical'
  if (magnitude > 6) return 'warning'
  return 'good'
}

function angularStatus(error: number) {
  const magnitude = Math.abs(error)
  if (magnitude > 18) return 'Recovering'
  if (magnitude > 6) return 'Correcting'
  return 'Locked'
}

export function HeadingPanel({ data, tone }: HeadingPanelProps) {
  const size = 116
  const center = size / 2
  const outerRadius = 45
  const yawPoint = polarPoint(center, center, outerRadius - 8, data.yawDeg)
  const errorTone = angularTone(data.angularErrorDeg)
  const errorColor =
    errorTone === 'critical'
      ? 'var(--danger)'
      : errorTone === 'warning'
        ? 'var(--warning)'
        : 'var(--success)'
  const errorWidth = `${clamp(Math.abs(data.angularErrorDeg) / 30, 0.08, 1) * 100}%`

  return (
    <DashboardCard
      title="Heading / Gyro"
      subtitle="orientation instrument"
      accent="accent"
      className="min-h-[0]"
      headerSlot={<StatusBadge tone={tone} label={tone === 'good' ? 'aligned' : tone === 'warning' ? 'correcting' : 'attention'} />}
      bodyClassName="pt-3.5"
    >
      <div className="grid gap-3 xl:grid-cols-2">
        <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface-alt)]/84 px-4 py-3.5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                Heading
              </div>
              <div className="mt-2 text-[2rem] font-semibold tracking-[-0.08em] text-[var(--text)]">
                {data.yawDeg.toFixed(1)}°
              </div>
              <div className="mt-2 text-[0.84rem] font-semibold uppercase tracking-[0.12em] text-[var(--success)]">
                Target: {data.targetYawDeg.toFixed(1)}°
              </div>
            </div>

            <svg viewBox={`0 0 ${size} ${size}`} className="h-[88px] w-[88px] shrink-0">
              <circle cx={center} cy={center} r={outerRadius + 7} fill="none" stroke="var(--gridLine)" strokeWidth="1.2" />
              <circle cx={center} cy={center} r={outerRadius} fill="none" stroke="var(--gaugeTrack)" strokeWidth="3.6" />

              {([
                ['N', 0],
                ['E', 90],
                ['S', 180],
                ['W', 270],
              ] as const).map(([label, degrees]) => {
                const point = polarPoint(center, center, outerRadius + 13, degrees)
                return (
                  <text
                    key={label}
                    x={point.x}
                    y={point.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="var(--text-muted)"
                    fontSize="11"
                    fontFamily="IBM Plex Mono, monospace"
                  >
                    {label}
                  </text>
                )
              })}

              <line
                x1={center}
                y1={center}
                x2={yawPoint.x}
                y2={yawPoint.y}
                stroke="var(--accent)"
                strokeWidth="4"
                strokeLinecap="round"
              />
              <circle cx={center} cy={center} r="5.5" fill="var(--surface-raised)" stroke="var(--text)" strokeWidth="1.2" />
            </svg>
          </div>
        </div>

        <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface-alt)]/84 px-4 py-3.5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                Angular Error
              </div>
              <div className="mt-2 text-[2rem] font-semibold tracking-[-0.08em] text-[var(--text)]">
                {Math.abs(data.angularErrorDeg).toFixed(1)}°
              </div>
            </div>
            <div className="pb-1 text-[0.8rem] font-semibold uppercase tracking-[0.14em]" style={{ color: errorColor }}>
              {angularStatus(data.angularErrorDeg)}
            </div>
          </div>

          <div className="mt-4 h-2.5 rounded-full bg-[var(--background-subtle)]">
            <div
              className="h-2.5 rounded-full transition-all duration-200"
              style={{
                width: errorWidth,
                background: errorColor,
              }}
            />
          </div>
        </div>
      </div>
    </DashboardCard>
  )
}
