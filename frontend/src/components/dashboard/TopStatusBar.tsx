import type { ReactNode } from 'react'
import { formatClock } from '../../lib/format'
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
      className="rounded-[22px] border border-[var(--border)] bg-[var(--surface)]/94 px-4 py-2.5 backdrop-blur-sm"
      style={{ boxShadow: 'var(--card-shadow-strong)' }}
    >
      <div className="grid gap-2.5 xl:grid-cols-[minmax(0,1.25fr)_auto_minmax(0,1fr)] xl:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[clamp(1.05rem,0.95rem+0.45vw,1.45rem)] font-semibold tracking-[-0.04em] text-[var(--text)]">
              AMR Reactive Telemetry
            </h1>
            <StatusBadge tone={statusTone} label={connection.online ? 'online' : 'offline'} />
            {extraBadges}
            <StatusBadge tone="neutral" label={scenarioLabel} />
          </div>
        </div>

        <div className="hidden xl:flex xl:justify-center">
          {controls}
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[0.76rem] text-[var(--text-muted)] xl:grid-cols-4 xl:text-right">
          <div>
            <span className="mr-1.5 font-semibold text-[var(--text)]">Team</span>
            {connection.team}
          </div>
          <div>
            <span className="mr-1.5 font-semibold text-[var(--text)]">Target</span>
            {connection.target}
          </div>
          <div>
            <span className="mr-1.5 font-semibold text-[var(--text)]">Host</span>
            {connection.hostSeen}
          </div>
          <div>
            <span className="mr-1.5 font-semibold text-[var(--text)]">Updated</span>
            {connection.online ? `${formatClock(timestamp)} | ${lastUpdatedLabel}` : lastUpdatedLabel}
          </div>
        </div>

        <div className="xl:hidden">{controls}</div>
      </div>
    </header>
  )
}
