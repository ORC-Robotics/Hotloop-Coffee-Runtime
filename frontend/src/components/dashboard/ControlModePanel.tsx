import { formatClock } from '../../lib/format'
import type {
  BridgeStatus,
  ConnectionStatus,
  ControlModeState,
  RobotControlMode,
} from '../../types/telemetry'
import { DashboardCard } from './DashboardCard'
import { StatusBadge } from './StatusBadge'

interface ControlModePanelProps {
  controlMode: ControlModeState
  selectedModeId: string | null
  onSelectMode: (modeId: string) => void
  onApplyMode: () => void
  connection: ConnectionStatus
  bridgeStatus?: BridgeStatus
}

function syncTone(syncStatus: ControlModeState['syncStatus']) {
  if (syncStatus === 'synced' || syncStatus === 'applied') return 'good'
  if (syncStatus === 'pending' || syncStatus === 'stale') return 'warning'
  if (syncStatus === 'rejected' || syncStatus === 'unavailable') return 'critical'
  return 'neutral'
}

function resolveModeLabel(modeId: string | null, modes: RobotControlMode[]) {
  if (!modeId) {
    return '--'
  }

  return modes.find((mode) => mode.id === modeId)?.label ?? modeId
}

export function ControlModePanel({
  controlMode,
  selectedModeId,
  onSelectMode,
  onApplyMode,
  connection,
  bridgeStatus,
}: ControlModePanelProps) {
  const canApply =
    !!selectedModeId &&
    controlMode.syncStatus !== 'pending' &&
    controlMode.syncStatus !== 'unavailable' &&
    connection.online &&
    controlMode.availableModes.some((mode) => mode.id === selectedModeId && mode.isAvailable) &&
    selectedModeId !== controlMode.currentModeId

  return (
    <DashboardCard
      title="Control Mode"
      subtitle="automode command"
      accent="warning"
      className="min-h-[0]"
      headerSlot={<StatusBadge tone={syncTone(controlMode.syncStatus)} label={controlMode.syncStatus} />}
    >
      <div className="flex h-full flex-col gap-2.5">
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-[16px] border border-[var(--border)] bg-[var(--surface-alt)]/82 px-3 py-2.5">
            <div className="text-[0.64rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Current mode</div>
            <div className="mt-1.5 text-[0.94rem] font-semibold text-[var(--text)]">
              {resolveModeLabel(controlMode.currentModeId, controlMode.availableModes)}
            </div>
          </div>
          <div className="rounded-[16px] border border-[var(--border)] bg-[var(--surface-alt)]/82 px-3 py-2.5">
            <div className="text-[0.64rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Requested</div>
            <div className="mt-1.5 text-[0.94rem] font-semibold text-[var(--text)]">
              {resolveModeLabel(selectedModeId ?? controlMode.requestedModeId, controlMode.availableModes)}
            </div>
          </div>
        </div>

        <div className="grid gap-2">
          {controlMode.availableModes.length === 0 ? (
            <div className="rounded-[16px] border border-dashed border-[var(--border)] bg-[var(--surface-alt)]/72 px-3 py-3 text-[0.78rem] text-[var(--text-muted)]">
              AUTOMODE chooser unavailable from the robot.
            </div>
          ) : (
            controlMode.availableModes.map((mode) => {
              const selected = selectedModeId === mode.id
              const current = controlMode.currentModeId === mode.id

              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => mode.isAvailable && onSelectMode(mode.id)}
                  disabled={!mode.isAvailable || !connection.online}
                  className="rounded-[16px] border px-3 py-2 text-left transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-55"
                  style={{
                    borderColor: selected ? 'var(--primary)' : 'var(--border)',
                    background: selected ? 'var(--primary-soft)' : 'var(--surface-alt)',
                    boxShadow: selected ? 'var(--card-shadow)' : undefined,
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-[0.8rem] font-semibold text-[var(--text)]">{mode.label}</div>
                      {mode.description ? (
                        <div className="mt-0.5 truncate text-[0.72rem] text-[var(--text-muted)]">{mode.description}</div>
                      ) : null}
                    </div>
                    <StatusBadge tone={current ? 'good' : mode.isAvailable ? 'neutral' : 'critical'} label={current ? 'current' : mode.isAvailable ? 'ready' : 'locked'} />
                  </div>
                </button>
              )
            })
          )}
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 text-[0.74rem] leading-5 text-[var(--text-muted)]">
            {controlMode.message || bridgeStatus?.message || 'Aguardando sincronizacao do AUTOMODE.'}
            {controlMode.lastCommandAt ? ` | cmd ${formatClock(controlMode.lastCommandAt)}` : ''}
          </div>
          <button
            type="button"
            onClick={onApplyMode}
            disabled={!canApply}
            className="rounded-full border px-4 py-2 text-[0.72rem] font-semibold uppercase tracking-[0.16em] transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-45"
            style={{
              borderColor: 'var(--primary)',
              background: 'var(--primary-soft)',
              color: 'var(--primary)',
            }}
          >
            {controlMode.syncStatus === 'pending' ? 'Applying...' : 'Apply'}
          </button>
        </div>
      </div>
    </DashboardCard>
  )
}
