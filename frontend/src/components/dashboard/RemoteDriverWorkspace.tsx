import { cn } from '../../lib/cn'
import { formatSeconds, formatSigned } from '../../lib/format'
import type { RemoteDriverAction, RemoteDriverStatus } from '../../types/telemetry'
import { DashboardCard } from './DashboardCard'
import { StatusBadge } from './StatusBadge'
import { useRemoteDriver } from '../../hooks/useRemoteDriver'

function summaryToneClass(tone: 'good' | 'warning' | 'critical' | 'info' | 'neutral') {
  if (tone === 'good') {
    return 'border-[var(--success)]/24 bg-[color-mix(in_srgb,var(--success)_10%,var(--surface)_90%)]'
  }

  if (tone === 'warning') {
    return 'border-[var(--warning)]/24 bg-[color-mix(in_srgb,var(--warning)_10%,var(--surface)_90%)]'
  }

  if (tone === 'critical') {
    return 'border-[var(--danger)]/24 bg-[color-mix(in_srgb,var(--danger)_10%,var(--surface)_90%)]'
  }

  if (tone === 'info') {
    return 'border-[var(--info)]/24 bg-[color-mix(in_srgb,var(--info)_10%,var(--surface)_90%)]'
  }

  return 'border-[var(--border)] bg-[var(--surface)]/84'
}

function modeLabel(status: RemoteDriverStatus) {
  if (status.mode === 'teleop') return 'Remote Teleop'
  if (status.mode === 'autonomous') return 'Autonomous'
  return 'Disabled'
}

function heartbeatTone(status: RemoteDriverStatus) {
  if (status.mode !== 'teleop') {
    return 'neutral' as const
  }

  if (status.heartbeatFresh) {
    return 'good' as const
  }

  return 'warning' as const
}

function actionButtonClass(tone: 'primary' | 'warning' | 'danger' | 'neutral') {
  if (tone === 'primary') {
    return 'border-[var(--primary)]/28 bg-[var(--primary-soft)] text-[var(--text)] hover:bg-[var(--primary-soft)]'
  }

  if (tone === 'warning') {
    return 'border-[var(--warning)]/28 bg-[color-mix(in_srgb,var(--warning)_12%,transparent)] text-[var(--text)] hover:bg-[color-mix(in_srgb,var(--warning)_16%,transparent)]'
  }

  if (tone === 'danger') {
    return 'border-[var(--danger)]/28 bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] text-[var(--text)] hover:bg-[color-mix(in_srgb,var(--danger)_16%,transparent)]'
  }

  return 'border-[var(--border)] bg-[var(--surface-alt)]/78 text-[var(--text-muted)] hover:bg-[var(--surface-alt)]'
}

function SummaryTile({
  label,
  value,
  detail,
  tone,
}: {
  label: string
  value: string
  detail: string
  tone: 'good' | 'warning' | 'critical' | 'info' | 'neutral'
}) {
  return (
    <div className={cn('rounded-[20px] border px-4 py-3', summaryToneClass(tone))} style={{ boxShadow: 'var(--card-shadow)' }}>
      <div className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">{label}</div>
      <div className="mt-2 text-[1.25rem] font-semibold tracking-[-0.04em] text-[var(--text)]">{value}</div>
      <div className="mt-1 text-[0.8rem] leading-6 text-[var(--text-muted)]">{detail}</div>
    </div>
  )
}

function AxisMeter({ label, value }: { label: string; value: number }) {
  const safeValue = Math.max(-1, Math.min(1, value))
  const width = `${Math.abs(safeValue) * 50}%`

  return (
    <div className="grid gap-2 rounded-[18px] border border-[var(--border)] bg-[var(--surface-alt)]/78 px-3 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">{label}</div>
        <div className="font-mono text-[0.82rem] text-[var(--text)]">{formatSigned(safeValue, 2)}</div>
      </div>

      <div className="relative h-3 overflow-hidden rounded-full bg-[var(--surface)]">
        <div className="absolute inset-y-0 left-1/2 w-px bg-[var(--border)]" />
        <div
          className={cn(
            'absolute inset-y-[2px] rounded-full',
            safeValue >= 0 ? 'left-1/2 bg-[var(--primary)]' : 'right-1/2 bg-[var(--accent)]',
          )}
          style={{ width }}
        />
      </div>
    </div>
  )
}

function ActionButton({
  label,
  hint,
  tone,
  onClick,
}: {
  label: string
  hint: string
  tone: 'primary' | 'warning' | 'danger' | 'neutral'
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-[20px] border px-4 py-3 text-left transition-colors',
        actionButtonClass(tone),
      )}
    >
      <div className="text-[0.76rem] font-semibold uppercase tracking-[0.14em]">{label}</div>
      <div className="mt-1 text-[0.78rem] leading-5 opacity-90">{hint}</div>
    </button>
  )
}

const driverActions: Array<{
  action: RemoteDriverAction
  label: string
  hint: string
  tone: 'primary' | 'warning' | 'danger' | 'neutral'
}> = [
  {
    action: 'enable_teleop',
    label: 'Enable Teleop',
    hint: 'Enable the custom remote teleop lane on the robot.',
    tone: 'primary',
  },
  {
    action: 'enable_auto',
    label: 'Enable Auto',
    hint: 'Run the robot using the selected Atlas autonomous mode.',
    tone: 'warning',
  },
  {
    action: 'disable',
    label: 'Disable',
    hint: 'Stop the active session and keep the robot safe.',
    tone: 'neutral',
  },
  {
    action: 'reset',
    label: 'Reset',
    hint: 'Reset encoders, yaw and restart lidar from the dashboard.',
    tone: 'warning',
  },
  {
    action: 'estop',
    label: 'E-Stop',
    hint: 'Immediate stop. Use when something looks wrong.',
    tone: 'danger',
  },
]

export function RemoteDriverWorkspace({ active }: { active: boolean }) {
  const {
    remoteDriver,
    bridgeStatus,
    controlsArmed,
    setControlsArmed,
    gyroAssist,
    setGyroAssist,
    preview,
    commandState,
    dispatchAction,
  } = useRemoteDriver(active)

  return (
    <div className="grid gap-3">
      <div className="grid gap-3 xl:grid-cols-5">
        <SummaryTile
          label="Bridge Link"
          value={bridgeStatus.connected ? 'Connected' : 'Offline'}
          detail={bridgeStatus.message ?? 'Bridge status unavailable.'}
          tone={bridgeStatus.connected ? 'good' : 'warning'}
        />
        <SummaryTile
          label="Robot Session"
          value={modeLabel(remoteDriver)}
          detail={remoteDriver.robotEnabled ? 'Robot reports enabled.' : 'Robot reports disabled.'}
          tone={remoteDriver.active ? 'good' : remoteDriver.mode === 'autonomous' ? 'warning' : 'neutral'}
        />
        <SummaryTile
          label="Heartbeat"
          value={
            remoteDriver.heartbeatAgeSec === null
              ? '--'
              : formatSeconds(remoteDriver.heartbeatAgeSec, 2)
          }
          detail={remoteDriver.heartbeatFresh ? 'Fresh packets are reaching the robot.' : 'No fresh packet confirmed yet.'}
          tone={heartbeatTone(remoteDriver)}
        />
        <SummaryTile
          label="Input Source"
          value={preview.inputSource === 'idle' ? 'Idle' : preview.inputSource}
          detail={preview.gamepadConnected ? preview.gamepadLabel : 'Keyboard fallback: WASD + Q/E'}
          tone={preview.gamepadConnected ? 'info' : 'neutral'}
        />
        <SummaryTile
          label="Remote Status"
          value={controlsArmed ? 'Armed' : 'Safe'}
          detail={remoteDriver.status}
          tone={controlsArmed ? 'good' : 'warning'}
        />
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(320px,0.92fr)_minmax(0,1.08fr)]">
        <DashboardCard
          title="Driver Actions"
          subtitle="enable, disable and safety controls"
          accent="accent"
          headerSlot={<StatusBadge tone={commandState.tone} label={commandState.tone === 'neutral' ? 'ready' : commandState.tone} />}
        >
          <div className="grid gap-3">
            <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface-alt)]/76 px-4 py-3 text-[0.82rem] leading-6 text-[var(--text-muted)]">
              This lane is separate from the physical console. It lets ORION send a safe remote teleop stream to Atlas, with heartbeat timeout and auto-disable if the packet stream stops.
            </div>

            <div className="grid gap-2 md:grid-cols-2">
              {driverActions.map((item) => (
                <ActionButton
                  key={item.action}
                  label={item.label}
                  hint={item.hint}
                  tone={item.tone}
                  onClick={() => {
                    void dispatchAction(item.action)
                  }}
                />
              ))}
            </div>

            <div className="grid gap-3 rounded-[20px] border border-[var(--border)] bg-[var(--surface-alt)]/78 px-4 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                    Packet Stream
                  </div>
                  <div className="mt-1 text-[0.9rem] font-semibold tracking-[-0.02em] text-[var(--text)]">
                    {controlsArmed ? 'Streaming live control packets.' : 'Controls are disarmed.'}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setControlsArmed((current) => !current)}
                  className={cn(
                    'rounded-full border px-4 py-2 text-[0.74rem] font-semibold uppercase tracking-[0.14em] transition-colors',
                    controlsArmed
                      ? 'border-[var(--success)]/28 bg-[color-mix(in_srgb,var(--success)_12%,transparent)] text-[var(--text)] hover:bg-[color-mix(in_srgb,var(--success)_16%,transparent)]'
                      : 'border-[var(--warning)]/28 bg-[color-mix(in_srgb,var(--warning)_12%,transparent)] text-[var(--text)] hover:bg-[color-mix(in_srgb,var(--warning)_16%,transparent)]',
                  )}
                >
                  {controlsArmed ? 'Disarm controls' : 'Arm controls'}
                </button>
              </div>

              <label className="flex items-center justify-between gap-3 rounded-[18px] border border-[var(--border)] bg-[var(--surface)]/76 px-4 py-3">
                <div>
                  <div className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                    Gyro Assist
                  </div>
                  <div className="mt-1 text-[0.8rem] leading-6 text-[var(--text-muted)]">
                    Keep heading hold active while the rotation axis stays neutral.
                  </div>
                </div>

                <input
                  type="checkbox"
                  checked={gyroAssist}
                  onChange={(event) => setGyroAssist(event.target.checked)}
                  className="h-5 w-5 accent-[var(--primary)]"
                />
              </label>

              <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface)]/76 px-4 py-3 text-[0.8rem] leading-6 text-[var(--text-muted)]">
                {commandState.message}
              </div>
            </div>
          </div>
        </DashboardCard>

        <DashboardCard
          title="Live Drive Feed"
          subtitle="gamepad or keyboard stream that ORION sends to the robot"
          accent="info"
          headerSlot={
            <div className="flex flex-wrap gap-2">
              <StatusBadge tone={preview.gamepadConnected ? 'info' : 'neutral'} label={preview.gamepadConnected ? 'gamepad connected' : 'keyboard fallback'} />
              <StatusBadge tone={heartbeatTone(remoteDriver)} label={remoteDriver.heartbeatFresh ? 'heartbeat fresh' : 'heartbeat stale'} />
            </div>
          }
        >
          <div className="grid gap-3">
            <div className="grid gap-3 md:grid-cols-3">
              <AxisMeter label="Strafe / X" value={preview.x} />
              <AxisMeter label="Forward / Y" value={preview.y} />
              <AxisMeter label="Rotate / Z" value={preview.z} />
            </div>

            <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.92fr)]">
              <div className="rounded-[20px] border border-[var(--border)] bg-[var(--surface-alt)]/78 px-4 py-4">
                <div className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                  Operator Tips
                </div>
                <div className="mt-3 grid gap-2 text-[0.82rem] leading-6 text-[var(--text-muted)]">
                  <div>Left stick controls strafe and forward motion.</div>
                  <div>Right stick X controls rotation.</div>
                  <div>Keyboard fallback uses `W A S D` for translation and `Q / E` for rotation.</div>
                  <div>When ORION loses focus, controls disarm and Atlas stops receiving live packets.</div>
                </div>
              </div>

              <div className="rounded-[20px] border border-[var(--border)] bg-[var(--surface-alt)]/78 px-4 py-4">
                <div className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                  Robot Echo
                </div>
                <div className="mt-3 grid gap-2">
                  {[
                    ['Mode', modeLabel(remoteDriver)],
                    ['Source', remoteDriver.source],
                    ['Input', remoteDriver.inputSource],
                    ['Last action', remoteDriver.lastAction],
                    ['Robot X', formatSigned(remoteDriver.driveX, 2)],
                    ['Robot Y', formatSigned(remoteDriver.driveY, 2)],
                    ['Robot Z', formatSigned(remoteDriver.driveZ, 2)],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-[16px] border border-[var(--border)] bg-[var(--surface)]/76 px-3 py-2.5">
                      <div className="text-[0.64rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">{label}</div>
                      <div className="mt-1 font-mono text-[0.84rem] text-[var(--text)]">{value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </DashboardCard>
      </div>
    </div>
  )
}
