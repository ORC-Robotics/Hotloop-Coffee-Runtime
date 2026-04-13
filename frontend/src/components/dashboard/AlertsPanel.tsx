import type { CSSProperties } from 'react'
import type { AlertItem } from '../../types/telemetry'
import { DashboardCard } from './DashboardCard'
import { StatusBadge } from './StatusBadge'

interface AlertsPanelProps {
  alerts: AlertItem[]
}

function severityIcon(severity: AlertItem['severity']) {
  if (severity === 'critical') return '!!'
  if (severity === 'warning') return '!'
  return 'i'
}

function alertStyle(severity: AlertItem['severity']): CSSProperties {
  if (severity === 'critical') {
    return {
      background: 'var(--danger-soft)',
      borderColor: 'color-mix(in srgb, var(--danger) 34%, var(--border))',
      boxShadow: 'var(--card-shadow)',
    }
  }

  if (severity === 'warning') {
    return {
      background: 'var(--warning-soft)',
      borderColor: 'color-mix(in srgb, var(--warning) 30%, var(--border))',
    }
  }

  return {
    background: 'var(--info-soft)',
    borderColor: 'color-mix(in srgb, var(--info) 24%, var(--border))',
  }
}

export function AlertsPanel({ alerts }: AlertsPanelProps) {
  const topAlerts = alerts.slice(0, 2)
  const dominant = topAlerts[0]?.severity ?? null

  return (
    <DashboardCard
      title="Alerts"
      subtitle="priority monitor"
      accent={dominant === 'critical' ? 'danger' : dominant === 'warning' ? 'warning' : 'danger'}
      className={dominant === 'critical' ? 'min-h-[150px]' : 'min-h-[136px]'}
      headerSlot={
        dominant ? (
          <StatusBadge tone={dominant === 'critical' ? 'critical' : dominant === 'warning' ? 'warning' : 'info'} label={dominant} />
        ) : (
          <StatusBadge tone="neutral" label="clear" />
        )
      }
    >
      <AlertsPanelBody alerts={alerts} />
    </DashboardCard>
  )
}

export function AlertsPanelBody({ alerts }: AlertsPanelProps) {
  const topAlerts = alerts.slice(0, 2)

  return topAlerts.length === 0 ? (
    <div className="flex h-full items-center justify-between gap-3 rounded-[16px] border border-dashed border-[var(--border)] bg-[var(--surface-alt)]/72 px-4 py-3 text-[0.8rem] leading-5 text-[var(--text-muted)]">
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[0.75rem] font-semibold text-[var(--text-muted)]">
        OK
      </span>
      <span className="flex-1">No active operational alerts.</span>
    </div>
  ) : (
    <div className="grid gap-2">
      {topAlerts.map((alert) => (
        <div key={alert.id} className="rounded-[16px] border px-3 py-2.5 transition-colors duration-200" style={alertStyle(alert.severity)}>
          <div className="flex items-start gap-3">
            <div
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[0.72rem] font-semibold"
              style={{
                borderColor:
                  alert.severity === 'critical'
                    ? 'color-mix(in srgb, var(--danger) 38%, var(--border))'
                    : alert.severity === 'warning'
                      ? 'color-mix(in srgb, var(--warning) 34%, var(--border))'
                      : 'color-mix(in srgb, var(--info) 28%, var(--border))',
                color:
                  alert.severity === 'critical'
                    ? 'var(--danger)'
                    : alert.severity === 'warning'
                      ? 'var(--warning)'
                      : 'var(--info)',
                background: 'var(--surface)',
              }}
            >
              {severityIcon(alert.severity)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[0.82rem] font-semibold tracking-[-0.02em] text-[var(--text)]">{alert.title}</div>
                <StatusBadge tone={alert.severity === 'critical' ? 'critical' : alert.severity === 'warning' ? 'warning' : 'info'} label={alert.severity} />
              </div>
              <p className="mt-1 text-[0.78rem] leading-5 text-[var(--text-muted)]">{alert.message}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
