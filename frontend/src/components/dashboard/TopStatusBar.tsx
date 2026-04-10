import type { ReactNode } from 'react'
import { formatClock } from '../../lib/format'
import { cn } from '../../lib/cn'
import type { ConnectionStatus } from '../../types/telemetry'
import { StatusBadge } from './StatusBadge'

interface TopStatusBarProps {
  connection: ConnectionStatus
  timestamp: string
  lastUpdatedLabel: string
  scenarioLabel: string
  statusTone: 'good' | 'warning' | 'critical' | 'info' | 'neutral'
  controls?: ReactNode
  extraBadges?: ReactNode
}

function DashboardGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.8">
      <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
      <path d="M8 3.5v4M16 3.5v4M3.5 10.5h17" />
    </svg>
  )
}

function LiveIndicator({ online }: { online: boolean }) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.64rem] font-semibold uppercase tracking-[0.16em]',
        online
          ? 'border-[var(--success)]/28 bg-[color-mix(in_srgb,var(--success)_12%,transparent)] text-[var(--success)]'
          : 'border-[var(--danger)]/28 bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] text-[var(--danger)]',
      )}
    >
      <span
        className={cn(
          'h-2 w-2 rounded-full',
          online ? 'bg-[var(--success)] shadow-[0_0_10px_var(--success)]' : 'bg-[var(--danger)]',
        )}
      />
      {online ? 'Online' : 'Offline'}
    </div>
  )
}

function InlineMeta({
  label,
  value,
}: {
  label: string
  value: string | number
}) {
  return (
    <div className="inline-flex items-center gap-1.5 text-[0.72rem]">
      <span className="font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">{label}</span>
      <span className="font-semibold tracking-[-0.02em] text-[var(--text)]">{value}</span>
    </div>
  )
}

export function TopStatusBar({
  connection,
  timestamp,
  lastUpdatedLabel,
  scenarioLabel,
  statusTone,
  controls,
  extraBadges,
}: TopStatusBarProps) {
  return (
    <header
      className="rounded-[20px] border border-[var(--border-strong)]/70 bg-[color-mix(in_srgb,var(--surface)_90%,var(--background)_10%)] px-3 py-2.5 backdrop-blur-md"
      style={{ boxShadow: 'var(--card-shadow-strong)' }}
    >
      <div className="grid gap-2 xl:grid-cols-[minmax(0,1fr)_auto_auto] xl:items-center">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] border border-[var(--border)] bg-[var(--surface-alt)]/84 text-[var(--primary)]">
              <DashboardGlyph />
            </div>

            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <div
                  data-display-font="true"
                  className="text-[0.78rem] leading-none text-[var(--text-muted)]"
                >
                  Coffee Runtime
                </div>
                <h1 className="truncate text-[clamp(1.2rem,1.04rem+0.48vw,1.58rem)] leading-none text-[var(--text)]">
                  Hotloop
                </h1>
                <LiveIndicator online={connection.online} />
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                <InlineMeta label="Team" value={connection.team} />
                <InlineMeta label="Target" value={connection.target} />
                <InlineMeta label="Host" value={connection.hostSeen} />
                <InlineMeta
                  label="Updated"
                  value={connection.online ? `${formatClock(timestamp)} | ${lastUpdatedLabel}` : lastUpdatedLabel}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 xl:justify-center">
          <StatusBadge tone={statusTone} label={connection.online ? 'link' : 'link down'} />
          {extraBadges}
          <StatusBadge tone="neutral" label={scenarioLabel} />
        </div>

        <div className="flex flex-wrap items-center gap-2 xl:justify-end">
          <div className="text-[0.64rem] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
            Controls
          </div>
          <div className="flex items-center gap-2">{controls}</div>
        </div>
      </div>
    </header>
  )
}
