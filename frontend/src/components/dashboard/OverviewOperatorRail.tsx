import { cn } from '../../lib/cn'
import { formatSigned, formatSeconds } from '../../lib/format'
import { useRemoteDriver } from '../../hooks/useRemoteDriver'
import { DashboardCard } from './DashboardCard'
import { StatusBadge } from './StatusBadge'

function driverTone(mode: 'disabled' | 'teleop' | 'autonomous') {
  if (mode === 'teleop') return 'good' as const
  if (mode === 'autonomous') return 'warning' as const
  return 'critical' as const
}

function driverLabel(mode: 'disabled' | 'teleop' | 'autonomous') {
  if (mode === 'teleop') return 'Teleop'
  if (mode === 'autonomous') return 'Auto'
  return 'Disabled'
}

function HoldKey({
  label,
  onHoldStart,
  onHoldEnd,
}: {
  label: string
  onHoldStart: () => void
  onHoldEnd: () => void
}) {
  return (
    <button
      type="button"
      onPointerDown={(event) => {
        event.preventDefault()
        event.currentTarget.setPointerCapture(event.pointerId)
        onHoldStart()
      }}
      onPointerUp={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId)
        }
        onHoldEnd()
      }}
      onPointerCancel={onHoldEnd}
      onLostPointerCapture={onHoldEnd}
      className="flex h-11 w-11 items-center justify-center rounded-[12px] border border-[var(--border)] bg-[var(--surface-alt)]/82 text-[0.84rem] font-semibold text-[var(--text)] transition-colors hover:bg-[var(--surface)]"
    >
      {label}
    </button>
  )
}

export function OverviewOperatorRail({ active }: { active: boolean }) {
  const {
    remoteDriver,
    controlsArmed,
    setControlsArmed,
    gyroAssist,
    setGyroAssist,
    preview,
    commandState,
    dispatchAction,
    setPanelDriveState,
  } = useRemoteDriver(active)

  return (
    <div className="grid gap-3">
      <DashboardCard
        title="Control"
        subtitle="driver enable lane"
        accent="warning"
        className="min-h-[0]"
        headerSlot={<StatusBadge tone={driverTone(remoteDriver.mode)} label={driverLabel(remoteDriver.mode)} />}
      >
        <div className="grid gap-3">
          <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface-alt)]/80 px-4 py-4">
            <div className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
              Current state
            </div>
            <div className="mt-2 text-[1.55rem] font-semibold tracking-[-0.05em] text-[var(--text)]">
              {driverLabel(remoteDriver.mode).toUpperCase()}
            </div>
            <div className="mt-2 text-[0.8rem] leading-6 text-[var(--text-muted)]">{remoteDriver.status}</div>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => void dispatchAction('enable_auto')}
              className="rounded-[14px] border border-[var(--border)] bg-[var(--surface-alt)]/80 px-4 py-3 text-[0.78rem] font-semibold text-[var(--text)] transition-colors hover:bg-[var(--surface)]"
            >
              Auto
            </button>
            <button
              type="button"
              onClick={() => void dispatchAction('enable_teleop')}
              className="rounded-[14px] border border-[var(--primary)]/28 bg-[var(--primary-soft)] px-4 py-3 text-[0.78rem] font-semibold text-[var(--text)] transition-colors hover:bg-[var(--primary-soft)]"
            >
              Teleop
            </button>
            <button
              type="button"
              onClick={() => void dispatchAction('disable')}
              className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)]/84 px-4 py-3 text-[0.78rem] font-semibold text-[var(--text)] transition-colors hover:bg-[var(--surface)]"
            >
              Disable
            </button>
          </div>

          <button
            type="button"
            onClick={() => void dispatchAction('estop')}
            className="rounded-[14px] border border-[var(--danger)]/40 bg-[color-mix(in_srgb,var(--danger)_16%,var(--surface)_84%)] px-4 py-3.5 text-[0.88rem] font-semibold uppercase tracking-[0.14em] text-[var(--text)] transition-colors hover:bg-[color-mix(in_srgb,var(--danger)_20%,var(--surface)_80%)]"
          >
            E-Stop
          </button>
        </div>
      </DashboardCard>

      <DashboardCard
        title="Teleop Controls"
        subtitle="keyboard or panel input"
        accent="accent"
        className="min-h-[0]"
        headerSlot={
          <StatusBadge
            tone={controlsArmed ? 'good' : remoteDriver.mode === 'teleop' ? 'warning' : 'neutral'}
            label={controlsArmed ? 'armed' : remoteDriver.mode === 'teleop' ? 'ready' : 'standby'}
          />
        }
      >
        <div className="grid gap-3">
          <div className="text-[0.78rem] leading-6 text-[var(--text-muted)]">
            {remoteDriver.mode === 'teleop'
              ? 'Use the live panel, keyboard, or gamepad to drive the robot model.'
              : 'Switch to TELEOP mode to enable live control input.'}
          </div>

          <div className="flex items-center justify-between gap-3 rounded-[16px] border border-[var(--border)] bg-[var(--surface-alt)]/78 px-4 py-3">
            <div>
              <div className="text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                Packet stream
              </div>
              <div className="mt-1 text-[0.84rem] text-[var(--text)]">
                {controlsArmed ? 'Live packets armed.' : 'Controls are safely disarmed.'}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setControlsArmed((current) => !current)}
              className={cn(
                'rounded-full border px-4 py-2 text-[0.68rem] font-semibold uppercase tracking-[0.14em] transition-colors',
                controlsArmed
                  ? 'border-[var(--success)]/28 bg-[color-mix(in_srgb,var(--success)_14%,transparent)] text-[var(--text)]'
                  : 'border-[var(--warning)]/28 bg-[color-mix(in_srgb,var(--warning)_14%,transparent)] text-[var(--text)]',
              )}
            >
              {controlsArmed ? 'Disarm' : 'Arm'}
            </button>
          </div>

          <div className="grid gap-2 justify-items-center">
            <HoldKey
              label="W"
              onHoldStart={() => setPanelDriveState({ x: 0, y: 0.78, z: 0 })}
              onHoldEnd={() => setPanelDriveState(null)}
            />
            <div className="grid grid-cols-3 gap-2">
              <HoldKey
                label="A"
                onHoldStart={() => setPanelDriveState({ x: -0.72, y: 0, z: 0 })}
                onHoldEnd={() => setPanelDriveState(null)}
              />
              <HoldKey
                label="S"
                onHoldStart={() => setPanelDriveState({ x: 0, y: -0.68, z: 0 })}
                onHoldEnd={() => setPanelDriveState(null)}
              />
              <HoldKey
                label="D"
                onHoldStart={() => setPanelDriveState({ x: 0.72, y: 0, z: 0 })}
                onHoldEnd={() => setPanelDriveState(null)}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <HoldKey
                label="Q"
                onHoldStart={() => setPanelDriveState({ x: 0, y: 0, z: -0.62 })}
                onHoldEnd={() => setPanelDriveState(null)}
              />
              <HoldKey
                label="E"
                onHoldStart={() => setPanelDriveState({ x: 0, y: 0, z: 0.62 })}
                onHoldEnd={() => setPanelDriveState(null)}
              />
            </div>
          </div>

          <div className="grid gap-2 grid-cols-3">
            {[
              ['FWD', formatSigned(preview.y, 1)],
              ['STR', formatSigned(preview.x, 1)],
              ['ROT', formatSigned(preview.z, 1)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-[14px] border border-[var(--border)] bg-[var(--surface-alt)]/78 px-3 py-2.5 text-center">
                <div className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">{label}</div>
                <div className="mt-1 font-mono text-[0.88rem] text-[var(--text)]">{value}</div>
              </div>
            ))}
          </div>
        </div>
      </DashboardCard>

      <DashboardCard
        title="Operator Link"
        subtitle="assist and input status"
        accent="info"
        className="min-h-[0]"
        headerSlot={
          <StatusBadge
            tone={remoteDriver.heartbeatFresh ? 'good' : remoteDriver.mode === 'teleop' ? 'warning' : 'neutral'}
            label={remoteDriver.heartbeatFresh ? 'heartbeat ok' : remoteDriver.mode === 'teleop' ? 'heartbeat stale' : 'idle'}
          />
        }
      >
        <div className="grid gap-3">
          <label className="flex items-center justify-between gap-3 rounded-[16px] border border-[var(--border)] bg-[var(--surface-alt)]/78 px-4 py-3">
            <div>
              <div className="text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                Gyro Assist
              </div>
              <div className="mt-1 text-[0.8rem] text-[var(--text-muted)]">
                Hold heading while rotation stays neutral.
              </div>
            </div>
            <input
              type="checkbox"
              checked={gyroAssist}
              onChange={(event) => setGyroAssist(event.target.checked)}
              className="h-5 w-5 accent-[var(--primary)]"
            />
          </label>

          <div className="grid gap-2">
            {[
              ['Input', preview.inputSource === 'idle' ? 'standby' : preview.inputSource],
              ['Gamepad', preview.gamepadConnected ? preview.gamepadLabel : 'No gamepad'],
              ['Heartbeat', remoteDriver.heartbeatAgeSec === null ? '--' : formatSeconds(remoteDriver.heartbeatAgeSec, 2)],
              ['Last action', remoteDriver.lastAction],
            ].map(([label, value]) => (
              <div key={label} className="rounded-[14px] border border-[var(--border)] bg-[var(--surface-alt)]/78 px-3 py-2.5">
                <div className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">{label}</div>
                <div className="mt-1 text-[0.82rem] text-[var(--text)]">{value}</div>
              </div>
            ))}
          </div>

          <div className="rounded-[16px] border border-[var(--border)] bg-[var(--surface)]/82 px-4 py-3 text-[0.78rem] leading-6 text-[var(--text-muted)]">
            {commandState.message}
          </div>
        </div>
      </DashboardCard>
    </div>
  )
}
