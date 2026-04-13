import { formatCommand } from '../../lib/format'
import type { CommandData, TelemetryDerivedState } from '../../types/telemetry'
import { DashboardCard } from './DashboardCard'

interface CommandsPanelProps {
  data: CommandData
  derived: TelemetryDerivedState
}

const commandMeta = [
  { key: 'center', label: 'Center', accent: 'var(--primary)' },
  { key: 'forward', label: 'Forward', accent: 'var(--success)' },
  { key: 'rotation', label: 'Rotation', accent: 'var(--accent)' },
] as const

export function CommandsPanel({ data, derived }: CommandsPanelProps) {
  return (
    <DashboardCard title="Commands" subtitle="active control signals" accent="success" className="min-h-[0]">
      <CommandsPanelBody data={data} derived={derived} />
    </DashboardCard>
  )
}

export function CommandsPanelBody({ data, derived }: CommandsPanelProps) {
  const commandDirection = {
    center: data.center > 0.08 ? 'bias right' : data.center < -0.08 ? 'bias left' : 'centered',
    forward: data.forward > 0.08 ? 'forward' : data.forward < -0.08 ? 'reverse' : 'hold',
    rotation: data.rotation > 0.08 ? 'rotate right' : data.rotation < -0.08 ? 'rotate left' : 'no turn',
  } as const

  return (
    <div className="flex h-full flex-col gap-2.5">
      <div className="rounded-[16px] border border-[var(--border)] bg-[var(--surface-alt)]/78 px-3 py-2 text-[0.74rem] leading-5 text-[var(--text-muted)]">
        {derived.commandNarrative}
      </div>

      <div className="grid gap-2">
        {commandMeta.map((item) => {
          const value = data[item.key]
          const normalized = Math.max(-1, Math.min(1, value))
          const width = `${Math.abs(normalized) * 50}%`

          return (
            <div key={item.key} className="rounded-[16px] border border-[var(--border)] bg-[var(--surface-alt)]/82 px-3 py-2.5">
              <div className="mb-1.5 flex items-center justify-between">
                <div className="text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                  {item.label}
                </div>
                <div className="font-mono text-[0.88rem] text-[var(--text)]">{formatCommand(value)}</div>
              </div>
              <div className="mb-1.5 flex items-center justify-between text-[0.66rem] uppercase tracking-[0.14em] text-[var(--text-muted)]">
                <span>{item.key === 'center' ? 'left' : item.key === 'rotation' ? 'rotate left' : 'reverse'}</span>
                <span>{commandDirection[item.key]}</span>
                <span>{item.key === 'center' ? 'right' : item.key === 'rotation' ? 'rotate right' : 'forward'}</span>
              </div>
              <div className="relative h-2.5 rounded-full bg-[var(--background-subtle)]">
                <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-[var(--border-strong)]" />
                <div
                  className="absolute top-0 h-2.5 rounded-full transition-all duration-200"
                  style={{
                    background: item.accent,
                    width,
                    left: normalized >= 0 ? '50%' : `calc(50% - ${width})`,
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
