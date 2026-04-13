import { Item, Picker, Switch } from '@adobe/react-spectrum'
import { useState } from 'react'
import { cn } from '../../lib/cn'
import { formatSeconds, formatSigned } from '../../lib/format'
import { useRemoteDriver } from '../../hooks/useRemoteDriver'
import type { ControlModeState, RemoteDriverSessionMode, RemoteDriverStatus } from '../../types/telemetry'
import { DashboardCard } from './DashboardCard'
import { StatusBadge } from './StatusBadge'

interface OverviewOperatorRailProps {
  controlMode: ControlModeState
  selectedModeId: string | null
  onSelectMode: (modeId: string | null) => void
  onApplyMode: (modeId?: string | null) => Promise<void> | void
}

function driverTone(mode: RemoteDriverStatus['mode']) {
  if (mode === 'teleop') return 'good' as const
  if (mode === 'autonomous') return 'warning' as const
  return 'critical' as const
}

function driverLabel(mode: RemoteDriverStatus['mode']) {
  if (mode === 'teleop') return 'Teleoperado'
  if (mode === 'autonomous') return 'Autonomo'
  return 'Disabled'
}

function inputLabel(inputSource: string) {
  if (inputSource === 'keyboard') return 'Keyboard'
  if (inputSource === 'gamepad') return 'Joystick'
  if (inputSource === 'hybrid') return 'Keyboard + joystick'
  if (inputSource === 'auto') return 'Autonomous routine'
  return 'Idle'
}

function resolveModeLabel(controlMode: ControlModeState, modeId: string | null) {
  if (!modeId) {
    return '--'
  }

  return controlMode.availableModes.find((mode) => mode.id === modeId)?.label ?? modeId
}

function heartbeatTone(status: RemoteDriverStatus) {
  if (status.mode !== 'teleop') {
    return 'neutral' as const
  }

  return status.heartbeatFresh ? 'good' as const : 'warning' as const
}

function streamTone(
  teleopStreaming: boolean,
  remoteDriver: RemoteDriverStatus,
  previewInputSource: string,
) {
  if (teleopStreaming && previewInputSource !== 'idle') {
    return 'good' as const
  }
  if (remoteDriver.mode === 'teleop') {
    return 'warning' as const
  }
  return 'neutral' as const
}

export function OverviewOperatorRail({
  controlMode,
  selectedModeId,
  onSelectMode,
  onApplyMode,
}: OverviewOperatorRailProps) {
  const {
    remoteDriver,
    bridgeStatus,
    gyroAssist,
    setGyroAssist,
    preview,
    commandState,
    dispatchAction,
    teleopStreaming,
  } = useRemoteDriver()
  const [selectedSessionMode, setSelectedSessionMode] = useState<RemoteDriverSessionMode>('teleop')
  const sessionActive = remoteDriver.mode !== 'disabled'
  const autoModeRequired = selectedSessionMode === 'autonomous'
  const selectedAutoLabel = resolveModeLabel(controlMode, selectedModeId)
  const localBackendOnline = bridgeStatus.connected
  const robotLinkOnline = bridgeStatus.robotLinkConnected ?? false
  const canStart =
    localBackendOnline &&
    robotLinkOnline &&
    !sessionActive &&
    (!autoModeRequired || Boolean(selectedModeId))
  const canDisable = sessionActive
  const bridgeSummary = !localBackendOnline
    ? 'Bridge backend unavailable. Open the network panel to reconnect the local service.'
    : !robotLinkOnline
      ? 'Bridge backend online, waiting for robot link. Use reconnect or update the robot host/IP below.'
      : bridgeStatus.message ?? 'Bridge backend online and synchronized with the robot.'

  const handleStart = async () => {
    if (selectedSessionMode === 'autonomous' && selectedModeId) {
      await onApplyMode(selectedModeId)
    }

    await dispatchAction('start', selectedSessionMode)
  }

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
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)]/82 px-3 py-2.5">
                <div className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                  Bridge
                </div>
                <div className="mt-1 text-[0.8rem] text-[var(--text)]">{bridgeSummary}</div>
              </div>
              <div className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)]/82 px-3 py-2.5">
                <div className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                  Auto mode
                </div>
                <div className="mt-1 text-[0.8rem] text-[var(--text)]">{selectedAutoLabel}</div>
              </div>
            </div>
          </div>

          <div className="grid gap-3 rounded-[18px] border border-[var(--border)] bg-[var(--surface-alt)]/76 px-4 py-4">
            <div className="grid gap-3">
              <Picker
                label="Session Picker"
                selectedKey={selectedSessionMode}
                onSelectionChange={(key) => setSelectedSessionMode(String(key) as RemoteDriverSessionMode)}
                width="100%"
              >
                <Item key="teleop">Teleoperado</Item>
                <Item key="autonomous">Autonomo</Item>
              </Picker>

              {autoModeRequired ? (
                <Picker
                  label="Auto Picker"
                  selectedKey={selectedModeId ?? undefined}
                  onSelectionChange={(key) => {
                    const nextModeId = String(key)
                    onSelectMode(nextModeId)
                    void onApplyMode(nextModeId)
                  }}
                  isDisabled={controlMode.availableModes.length === 0}
                  placeholder={controlMode.availableModes.length === 0 ? 'No automode available' : undefined}
                  width="100%"
                >
                  {controlMode.availableModes.map((mode) => (
                    <Item key={mode.id}>{mode.label}</Item>
                  ))}
                </Picker>
              ) : null}
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => void handleStart()}
                disabled={!canStart}
                className={cn(
                  'rounded-[14px] border px-4 py-3 text-[0.8rem] font-semibold uppercase tracking-[0.14em] transition-colors',
                  canStart
                    ? 'border-[var(--primary)]/28 bg-[var(--primary-soft)] text-[var(--text)] hover:bg-[var(--primary-soft)]'
                    : 'cursor-not-allowed border-[var(--border)] bg-[var(--surface)]/72 text-[var(--text-muted)] opacity-70',
                )}
              >
                Start
              </button>
              <button
                type="button"
                onClick={() => void dispatchAction('disable')}
                disabled={!canDisable}
                className={cn(
                  'rounded-[14px] border px-4 py-3 text-[0.8rem] font-semibold uppercase tracking-[0.14em] transition-colors',
                  canDisable
                    ? 'border-[var(--border)] bg-[var(--surface)]/84 text-[var(--text)] hover:bg-[var(--surface)]'
                    : 'cursor-not-allowed border-[var(--border)] bg-[var(--surface)]/72 text-[var(--text-muted)] opacity-70',
                )}
              >
                Disable
              </button>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => void dispatchAction('reset')}
                className="rounded-[14px] border border-[var(--border)] bg-[var(--surface-alt)]/80 px-4 py-3 text-[0.76rem] font-semibold text-[var(--text)] transition-colors hover:bg-[var(--surface)]"
              >
                Reset session
              </button>
              <button
                type="button"
                onClick={() => void dispatchAction('estop')}
                className="rounded-[14px] border border-[var(--danger)]/40 bg-[color-mix(in_srgb,var(--danger)_16%,var(--surface)_84%)] px-4 py-3 text-[0.76rem] font-semibold uppercase tracking-[0.14em] text-[var(--text)] transition-colors hover:bg-[color-mix(in_srgb,var(--danger)_20%,var(--surface)_80%)]"
              >
                E-Stop
              </button>
            </div>

            <div className="rounded-[16px] border border-[var(--border)] bg-[var(--surface)]/82 px-4 py-3 text-[0.78rem] leading-6 text-[var(--text-muted)]">
              {sessionActive
                ? 'There is an active session on the robot. Change the pickers freely if needed, then press Disable before a new Start.'
                : robotLinkOnline
                  ? 'Choose Teleoperado or Autonomo, confirm the automode when needed, then press Start to make the robot enter the selected session.'
                  : 'Choose the session first if you want, then reconnect the robot link before pressing Start.'}
            </div>
          </div>
        </div>
      </DashboardCard>

      <DashboardCard
        title="Operator Link"
        subtitle="assist and input status"
        accent="info"
        className="min-h-[0]"
        headerSlot={<StatusBadge tone={heartbeatTone(remoteDriver)} label={remoteDriver.heartbeatFresh ? 'heartbeat ok' : remoteDriver.mode === 'teleop' ? 'waiting heartbeat' : 'idle'} />}
      >
        <div className="grid gap-3">
          <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface-alt)]/78 px-4 py-4">
            <Switch isSelected={gyroAssist} onChange={setGyroAssist}>
              Gyro Assist
            </Switch>
            <div className="mt-2 text-[0.8rem] leading-6 text-[var(--text-muted)]">
              Keep heading locked when the rotation axis stays neutral during teleop.
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {[
              ['Input Status', inputLabel(preview.inputSource === 'idle' ? remoteDriver.inputSource : preview.inputSource)],
              ['Gamepad', preview.gamepadConnected ? preview.gamepadLabel : 'No joystick detected'],
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

      <DashboardCard
        title="Teleop Input"
        subtitle="keyboard or joystick only"
        accent="accent"
        className="min-h-[0]"
        headerSlot={
          <StatusBadge
            tone={streamTone(teleopStreaming, remoteDriver, preview.inputSource)}
            label={
              teleopStreaming && preview.inputSource !== 'idle'
                ? 'streaming'
                : remoteDriver.mode === 'teleop'
                  ? 'ready'
                  : 'standby'
            }
          />
        }
      >
        <div className="grid gap-3">
          <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface-alt)]/78 px-4 py-4 text-[0.8rem] leading-6 text-[var(--text-muted)]">
            Hotloop now accepts only physical input devices. Use <span className="font-mono text-[var(--text)]">W A S D</span> for translation,
            <span className="font-mono text-[var(--text)]"> Q / E</span> for rotation, or a joystick/gamepad for analog control. No touch pad remains on screen.
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
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

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-[14px] border border-[var(--border)] bg-[var(--surface-alt)]/78 px-3 py-2.5">
              <div className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Teleop heartbeat</div>
              <div className="mt-1 text-[0.82rem] text-[var(--text)]">
                {teleopStreaming
                  ? 'Packets are transmitted automatically while teleop is active.'
                  : 'Heartbeat only starts after Teleoperado + Start.'}
              </div>
            </div>
            <div className="rounded-[14px] border border-[var(--border)] bg-[var(--surface-alt)]/78 px-3 py-2.5">
              <div className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Source</div>
              <div className="mt-1 text-[0.82rem] text-[var(--text)]">{bridgeStatus.transport}</div>
            </div>
          </div>
        </div>
      </DashboardCard>
    </div>
  )
}
