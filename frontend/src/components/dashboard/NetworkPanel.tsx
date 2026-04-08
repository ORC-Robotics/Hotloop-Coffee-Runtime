import type { BridgeStatus, ConnectionStatus, ControlModeState, UiTone } from '../../types/telemetry'
import { DashboardCard } from './DashboardCard'
import { StatusBadge } from './StatusBadge'

interface NetworkPanelProps {
  data: ConnectionStatus
  tone: UiTone
  bridgeStatus?: BridgeStatus
  controlMode?: ControlModeState
}

function syncTone(status: ControlModeState['syncStatus'] | undefined): UiTone {
  if (status === 'synced' || status === 'applied') return 'good'
  if (status === 'pending' || status === 'stale') return 'warning'
  if (status === 'rejected' || status === 'unavailable') return 'critical'
  return 'neutral'
}

export function NetworkPanel({ data, tone, bridgeStatus, controlMode }: NetworkPanelProps) {
  return (
    <DashboardCard
      title="Bridge / Network"
      subtitle="telemetry path"
      accent="primary"
      className="min-h-[0]"
      headerSlot={<StatusBadge tone={tone} label={data.health} />}
    >
      <div className="grid gap-2">
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            ['Connection', data.online ? 'online' : 'offline'],
            ['Route', data.routeLabel],
            ['Host', data.hostSeen],
            ['Chooser', bridgeStatus?.chooserPath ?? 'SmartDashboard/Auto mode'],
          ].map(([label, value]) => (
            <div key={label} className="rounded-[16px] border border-[var(--border)] bg-[var(--surface-alt)]/82 px-3 py-2.5">
              <div className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">{label}</div>
              <div className="mt-1.5 text-[0.8rem] text-[var(--text)]">{value}</div>
            </div>
          ))}
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-[16px] border border-[var(--border)] bg-[var(--surface-alt)]/82 px-3 py-2.5">
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <div className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Bridge transport</div>
              <StatusBadge tone={bridgeStatus?.connected ? 'good' : 'critical'} label={bridgeStatus?.connected ? 'up' : 'down'} />
            </div>
            <div className="text-[0.8rem] text-[var(--text)]">{bridgeStatus?.transport ?? 'networktables'}</div>
          </div>

          <div className="rounded-[16px] border border-[var(--border)] bg-[var(--surface-alt)]/82 px-3 py-2.5">
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <div className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">AUTOMODE sync</div>
              <StatusBadge tone={syncTone(controlMode?.syncStatus)} label={controlMode?.syncStatus ?? 'unknown'} />
            </div>
            <div className="text-[0.8rem] text-[var(--text)]">{controlMode?.message ?? bridgeStatus?.message ?? '--'}</div>
          </div>
        </div>
      </div>
    </DashboardCard>
  )
}
