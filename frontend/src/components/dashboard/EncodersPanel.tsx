import { formatCentimeters, formatMillimeters } from '../../lib/format'
import type { EncoderData } from '../../types/telemetry'
import { DashboardCard } from './DashboardCard'

interface EncodersPanelProps {
  data: EncoderData
}

export function EncodersPanel({ data }: EncodersPanelProps) {
  const leftRightDelta = data.leftMm - data.rightMm

  return (
    <DashboardCard title="Encoders / Motion" subtitle="wheel and odometry counters" accent="primary" className="min-h-[230px]">
      <div className="grid h-full gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <div className="grid gap-2.5 sm:grid-cols-2">
          {[
            ['Encoder Left', formatMillimeters(data.leftMm)],
            ['Encoder Right', formatMillimeters(data.rightMm)],
            ['Encoder Back', formatMillimeters(data.backMm)],
            ['Forward Distance', formatCentimeters(data.forwardDistanceCm)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-[18px] border border-[var(--border)] bg-[var(--surface-alt)]/80 px-3 py-3">
              <div className="text-[0.67rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">{label}</div>
              <div className="mt-1.5 font-mono text-[0.95rem] text-[var(--text)]">{value}</div>
            </div>
          ))}
        </div>

        <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface-alt)]/80 px-3.5 py-3">
          <div className="text-[0.67rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
            Differential balance
          </div>
          <div className="mt-3 grid gap-3">
            {[
              ['Left track', data.leftMm, 'var(--primary)'],
              ['Right track', data.rightMm, 'var(--info)'],
            ].map(([label, value, color]) => (
              <div key={label}>
                <div className="mb-1.5 flex items-center justify-between text-[0.8rem]">
                  <span className="text-[var(--text-muted)]">{label}</span>
                  <span className="font-mono text-[var(--text)]">{formatMillimeters(Number(value))}</span>
                </div>
                <div className="h-2.5 rounded-full bg-[var(--background-subtle)]">
                  <div
                    className="h-2.5 rounded-full"
                    style={{
                      background: String(color),
                      width: `${Math.min(100, (Number(value) / Math.max(data.leftMm, data.rightMm, 1)) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[0.8rem] leading-5 text-[var(--text-muted)]">
            Left/right delta is <span className="font-mono text-[var(--text)]">{formatMillimeters(leftRightDelta)}</span>,
            useful for spotting bias during corridor tracking.
          </p>
        </div>
      </div>
    </DashboardCard>
  )
}
