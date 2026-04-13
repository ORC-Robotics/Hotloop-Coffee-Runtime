import type { SystemHealthData, UiTone } from '../../types/telemetry'
import { DashboardCard } from './DashboardCard'
import { StatusBadge } from './StatusBadge'

interface SystemsHealthPanelProps {
  data: SystemHealthData
  overallTone: UiTone
}

const healthItems = [
  ['LiDAR', 'lidarHealthy'],
  ['NavX', 'navxConnected'],
  ['Valid Scan', 'validScan'],
  ['Gyro Hold', 'gyroHold'],
] as const

export function SystemsHealthPanel({ data, overallTone }: SystemsHealthPanelProps) {
  return (
    <DashboardCard
      title="Systems Health"
      subtitle="critical sensing chain"
      accent="info"
      className="min-h-[156px]"
      headerSlot={<StatusBadge tone={overallTone} label={overallTone === 'good' ? 'healthy' : 'degraded'} />}
    >
      <SystemsHealthPanelBody data={data} />
    </DashboardCard>
  )
}

export function SystemsHealthPanelBody({ data }: Pick<SystemsHealthPanelProps, 'data'>) {
  return (
    <div className="grid h-full gap-2 sm:grid-cols-2">
      {healthItems.map(([label, key]) => {
        const value = data[key]
        const tone = key === 'gyroHold' ? (value ? 'info' : 'neutral') : value ? 'good' : 'critical'

        return (
          <div key={label} className="rounded-[16px] border border-[var(--border)] bg-[var(--surface-alt)]/82 px-3 py-2.5">
            <div className="mb-1.5 text-[0.64rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
              {label}
            </div>
            <StatusBadge tone={tone} label={value ? 'active' : key === 'gyroHold' ? 'idle' : 'offline'} />
          </div>
        )
      })}
    </div>
  )
}
