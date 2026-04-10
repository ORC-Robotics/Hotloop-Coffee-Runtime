import { formatMillimeters } from '../../lib/format'
import type { PerceptionData } from '../../types/telemetry'
import { DashboardCard } from './DashboardCard'
import { StatusBadge } from './StatusBadge'

interface PerceptionPanelProps {
  data: PerceptionData
}

export function PerceptionPanel({ data }: PerceptionPanelProps) {
  const frontTone = data.frontBlocked ? 'critical' : data.frontSlow ? 'warning' : 'good'
  const openingLabel =
    data.leftOpenFlag && data.rightOpenFlag
      ? 'dual openings'
      : data.leftOpenFlag
        ? 'opening left'
        : data.rightOpenFlag
          ? 'opening right'
          : 'corridor contained'
  const width = 640
  const height = 320
  const centerX = width / 2
  const baseY = height - 30
  const topY = 40
  const frontScale = Math.max(44, (data.frontMedianMm / 1800) * (baseY - topY - 42))
  const leftScale = Math.max(26, (data.leftWallMm / 1300) * 170)
  const rightScale = Math.max(26, (data.rightWallMm / 1300) * 170)
  const leftOpenScale = Math.max(16, (data.leftOpenMm / 1900) * 210)
  const rightOpenScale = Math.max(16, (data.rightOpenMm / 1900) * 210)

  return (
    <DashboardCard
      title="Perception"
      subtitle="corridor geometry and openings"
      accent="info"
      className="min-h-[0]"
      headerSlot={<StatusBadge tone={frontTone} label={data.frontBlocked ? 'blocked' : data.frontSlow ? 'slow zone' : 'clear lane'} />}
    >
      <div className="flex h-full flex-col gap-2.5">
        <div className="rounded-[20px] border border-[var(--border)] bg-[var(--surface-alt)]/80 p-3">
          <svg viewBox={`0 0 ${width} ${height}`} className="h-[250px] w-full">
            {Array.from({ length: 18 }, (_, index) => (
              <line
                key={`v-${index}`}
                x1={index * 38}
                y1={0}
                x2={index * 38}
                y2={height}
                stroke="var(--gridLine)"
                strokeWidth="1"
              />
            ))}
            {Array.from({ length: 9 }, (_, index) => (
              <line
                key={`h-${index}`}
                x1={0}
                y1={index * 36}
                x2={width}
                y2={index * 36}
                stroke="var(--gridLine)"
                strokeWidth="1"
              />
            ))}

            <polygon
              points={`${120},${topY} ${520},${topY} ${570},${baseY} ${70},${baseY}`}
              fill="none"
              stroke="var(--border-strong)"
              strokeWidth="2.4"
            />

            <line x1={centerX} y1={baseY - 58} x2={centerX} y2={baseY - 58 - frontScale} stroke="var(--danger)" strokeWidth="12" strokeLinecap="round" />
            <line x1={centerX - 22} y1={baseY - 16} x2={centerX - 22 - leftScale} y2={baseY - 16} stroke="var(--primary)" strokeWidth="10" strokeLinecap="round" />
            <line x1={centerX + 22} y1={baseY - 16} x2={centerX + 22 + rightScale} y2={baseY - 16} stroke="var(--primary)" strokeWidth="10" strokeLinecap="round" />
            <line x1={centerX - 14} y1={baseY - 64} x2={centerX - 14 - leftOpenScale} y2={baseY - 64} stroke="var(--info)" strokeWidth="5" strokeLinecap="round" />
            <line x1={centerX + 14} y1={baseY - 64} x2={centerX + 14 + rightOpenScale} y2={baseY - 64} stroke="var(--info)" strokeWidth="5" strokeLinecap="round" />

            <rect x={centerX - 22} y={baseY - 74} width="44" height="58" fill="var(--surface-raised)" stroke="var(--text)" strokeWidth="2" />
            <line x1={centerX - 44} y1={baseY - 28} x2={centerX - 20} y2={baseY - 28} stroke="var(--text)" strokeWidth="10" strokeLinecap="round" opacity="0.8" />
            <line x1={centerX + 20} y1={baseY - 28} x2={centerX + 44} y2={baseY - 28} stroke="var(--text)" strokeWidth="10" strokeLinecap="round" opacity="0.8" />

            <text x={centerX} y={28} textAnchor="middle" fill="var(--danger)" fontSize="16" fontFamily="IBM Plex Mono, monospace">
              FRONT {formatMillimeters(data.frontMedianMm)}
            </text>
            <rect
              x="20"
              y="18"
              width="126"
              height="24"
              rx="12"
              fill="color-mix(in srgb, var(--primary) 10%, var(--surface))"
              stroke="var(--primary)"
              strokeWidth="1.1"
            />
            <text x="83" y="34" textAnchor="middle" fill="var(--text)" fontSize="12" fontFamily="IBM Plex Mono, monospace">
              ROBOT LEFT
            </text>
            <rect
              x="494"
              y="18"
              width="126"
              height="24"
              rx="12"
              fill="color-mix(in srgb, var(--primary) 10%, var(--surface))"
              stroke="var(--primary)"
              strokeWidth="1.1"
            />
            <text x="557" y="34" textAnchor="middle" fill="var(--text)" fontSize="12" fontFamily="IBM Plex Mono, monospace">
              ROBOT RIGHT
            </text>
            <text x={centerX} y={baseY + 18} textAnchor="middle" fill="var(--text-muted)" fontSize="12" fontFamily="IBM Plex Mono, monospace">
              ROBOT FRONT
            </text>
            <text x={86} y={baseY - 38} fill="var(--primary)" fontSize="14" fontFamily="IBM Plex Mono, monospace">
              L WALL {formatMillimeters(data.leftWallMm)}
            </text>
            <text x={width - 198} y={baseY - 38} fill="var(--primary)" fontSize="14" fontFamily="IBM Plex Mono, monospace">
              R WALL {formatMillimeters(data.rightWallMm)}
            </text>
            <text x={92} y={baseY - 98} fill="var(--info)" fontSize="14" fontFamily="IBM Plex Mono, monospace">
              L OPEN {formatMillimeters(data.leftOpenMm)}
            </text>
            <text x={width - 208} y={baseY - 98} fill="var(--info)" fontSize="14" fontFamily="IBM Plex Mono, monospace">
              R OPEN {formatMillimeters(data.rightOpenMm)}
            </text>
            <text x={centerX} y={baseY - 108} textAnchor="middle" fill="var(--warning)" fontSize="13" fontFamily="IBM Plex Mono, monospace">
              {openingLabel.toUpperCase()}
            </text>
          </svg>
        </div>

        <div className="grid gap-2 md:grid-cols-5">
          {[
            ['Front', formatMillimeters(data.frontMedianMm)],
            ['Left wall', formatMillimeters(data.leftWallMm)],
            ['Right wall', formatMillimeters(data.rightWallMm)],
            ['Left open', formatMillimeters(data.leftOpenMm)],
            ['Right open', formatMillimeters(data.rightOpenMm)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-[16px] border border-[var(--border)] bg-[var(--surface-alt)]/82 px-3 py-2">
              <div className="text-[0.64rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">{label}</div>
              <div className="mt-1 font-mono text-[0.9rem] text-[var(--text)]">{value}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5">
          <StatusBadge tone={data.frontBlocked ? 'critical' : 'neutral'} label={`front blocked ${data.frontBlocked ? 'yes' : 'no'}`} />
          <StatusBadge tone={data.frontSlow ? 'warning' : 'neutral'} label={`front slow ${data.frontSlow ? 'yes' : 'no'}`} />
          <StatusBadge tone={data.leftOpenFlag ? 'good' : 'neutral'} label={`left open ${data.leftOpenFlag ? 'yes' : 'no'}`} />
          <StatusBadge tone={data.rightOpenFlag ? 'good' : 'neutral'} label={`right open ${data.rightOpenFlag ? 'yes' : 'no'}`} />
          <StatusBadge tone={data.deadEnd ? 'critical' : 'neutral'} label={`dead end ${data.deadEnd ? 'yes' : 'no'}`} />
        </div>
      </div>
    </DashboardCard>
  )
}
