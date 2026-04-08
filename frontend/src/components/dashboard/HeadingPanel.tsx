import { formatDegrees } from '../../lib/format'
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
  if (magnitude > 8) return 'warning'
  return 'good'
}

export function HeadingPanel({ data, tone }: HeadingPanelProps) {
  const size = 360
  const center = size / 2
  const radius = 126
  const yawPoint = polarPoint(center, center, radius - 24, data.yawDeg)
  const targetPoint = polarPoint(center, center, radius - 4, data.targetYawDeg)
  const errorTone = angularTone(data.angularErrorDeg)
  const errorColor =
    errorTone === 'critical'
      ? 'var(--danger)'
      : errorTone === 'warning'
        ? 'var(--warning)'
        : 'var(--success)'

  return (
    <DashboardCard
      title="Heading / Gyro"
      subtitle="orientation instrument"
      accent="accent"
      className="min-h-[0]"
      headerSlot={<StatusBadge tone={tone} label={tone === 'good' ? 'aligned' : tone === 'warning' ? 'correcting' : 'attention'} />}
    >
      <div className="flex h-full flex-col gap-3">
        <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface-alt)]/84 p-2.5">
          <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto aspect-square w-full max-w-[320px]">
            <circle cx={center} cy={center} r={radius + 18} fill="none" stroke="var(--gridLine)" strokeWidth="1.4" />
            <circle cx={center} cy={center} r={radius} fill="none" stroke="var(--gaugeTrack)" strokeWidth="4" />

            {Array.from({ length: 36 }, (_, index) => {
              const degrees = index * 10
              const inner = index % 3 === 0 ? radius - 17 : radius - 10
              const start = polarPoint(center, center, inner, degrees)
              const end = polarPoint(center, center, radius + 5, degrees)
              return (
                <line
                  key={degrees}
                  x1={start.x}
                  y1={start.y}
                  x2={end.x}
                  y2={end.y}
                  stroke="var(--gaugeTick)"
                  strokeWidth={index % 3 === 0 ? 1.8 : 1}
                  opacity={index % 3 === 0 ? 0.95 : 0.45}
                />
              )
            })}

            {[0, 90, 180, 270].map((degrees) => {
              const label = polarPoint(center, center, radius + 28, degrees)
              return (
                <text
                  key={degrees}
                  x={label.x}
                  y={label.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="var(--text-muted)"
                  fontSize="12"
                  fontFamily="IBM Plex Mono, monospace"
                >
                  {degrees}
                </text>
              )
            })}

            <line
              x1={center}
              y1={center}
              x2={targetPoint.x}
              y2={targetPoint.y}
              stroke="var(--info)"
              strokeWidth="2.8"
              opacity="0.95"
            />
            <circle cx={targetPoint.x} cy={targetPoint.y} r="5.5" fill="var(--info)" />

            <line
              x1={center}
              y1={center}
              x2={yawPoint.x}
              y2={yawPoint.y}
              stroke="var(--accent)"
              strokeWidth="5.4"
              strokeLinecap="round"
            />
            <circle cx={center} cy={center} r="8" fill="var(--surface-raised)" stroke="var(--text)" strokeWidth="1.4" />

            <text
              x={center}
              y={size - 24}
              textAnchor="middle"
              fill="var(--text)"
              fontSize="32"
              fontFamily="IBM Plex Mono, monospace"
            >
              {data.yawDeg.toFixed(1)}
            </text>
          </svg>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-3">
          <div className="rounded-[16px] border border-[var(--border)] bg-[var(--surface-alt)]/82 px-3 py-2.5">
            <div className="text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Yaw</div>
            <div className="mt-1.5 font-mono text-[1rem] text-[var(--text)]">{formatDegrees(data.yawDeg)}</div>
          </div>
          <div className="rounded-[16px] border border-[var(--border)] bg-[var(--surface-alt)]/82 px-3 py-2.5">
            <div className="text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Target yaw</div>
            <div className="mt-1.5 font-mono text-[1rem] text-[var(--text)]">{formatDegrees(data.targetYawDeg)}</div>
          </div>
          <div
            className="rounded-[16px] border px-3 py-2.5"
            style={{
              borderColor: `color-mix(in srgb, ${errorColor} 26%, var(--border))`,
              background: errorTone === 'good' ? 'var(--success-soft)' : errorTone === 'warning' ? 'var(--warning-soft)' : 'var(--danger-soft)',
            }}
          >
            <div className="text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Angular error</div>
            <div className="mt-1.5 font-mono text-[1rem]" style={{ color: errorColor }}>
              {formatDegrees(data.angularErrorDeg)}
            </div>
          </div>
        </div>

        <div className="rounded-[16px] border border-[var(--border)] bg-[var(--surface-alt)]/78 px-3 py-2 text-[0.75rem] text-[var(--text-muted)]">
          Lateral error <span className="font-mono text-[var(--text)]">{data.lateralErrorM.toFixed(2)} m</span>
        </div>
      </div>
    </DashboardCard>
  )
}
