import { useEffect, useState } from 'react'
import { getBridgeConnectionStatus, updateBridgeConnection } from '../../data/telemetryGateway'
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
  const [manualHostInput, setManualHostInput] = useState(bridgeStatus?.manualHost ?? '')
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const localBackendOnline = bridgeStatus?.connected ?? false
  const robotLinkOnline = bridgeStatus?.robotLinkConnected ?? data.online
  const configuredHost = bridgeStatus?.manualHost?.trim() ? bridgeStatus.manualHost : 'team discovery'
  const canRetryLocalBackend = Boolean(window.orionDesktop?.restartBridge)

  useEffect(() => {
    setManualHostInput(bridgeStatus?.manualHost ?? '')
  }, [bridgeStatus?.manualHost])

  const handleReconnect = async () => {
    setIsSubmitting(true)
    setActionMessage(null)

    try {
      if (!localBackendOnline) {
        if (!window.orionDesktop?.restartBridge) {
          setActionMessage('The local bridge backend is offline and this environment cannot restart it automatically.')
          return
        }

        const restart = await window.orionDesktop.restartBridge()
        if (!restart.ok) {
          setActionMessage('Hotloop retried the local bridge backend, but it is still starting or unavailable.')
          return
        }

        await getBridgeConnectionStatus()
        setActionMessage('Local bridge backend restarted. If the robot link is still waiting, use Reconnect or update the robot host/IP.')
        return
      }

      const response = await updateBridgeConnection(undefined, undefined, true)
      setActionMessage(response.error ?? response.message ?? 'Reconnect requested.')
    } catch {
      setActionMessage('Unable to reach the local bridge backend. Start or restore the backend service first.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleApplyHost = async () => {
    const trimmedHost = manualHostInput.trim()
    if (!trimmedHost) {
      setActionMessage('Type an IP or hostname before applying a manual robot target.')
      return
    }

    setIsSubmitting(true)
    setActionMessage(null)

    try {
      const response = await updateBridgeConnection(trimmedHost, 'manual-host', true)
      setActionMessage(
        response.error ?? response.message ?? `Manual host override applied to ${trimmedHost}.`,
      )
    } catch {
      setActionMessage('Unable to save the manual robot host because the local bridge backend is unavailable.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUseTeamAuto = async () => {
    setIsSubmitting(true)
    setActionMessage(null)

    try {
      const response = await updateBridgeConnection(null, 'team-auto', true)
      setManualHostInput('')
      setActionMessage(response.error ?? response.message ?? 'Team auto discovery restored.')
    } catch {
      setActionMessage('Unable to restore team auto discovery because the local bridge backend is unavailable.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <DashboardCard
      title="Bridge / Network"
      subtitle="backend and robot link"
      accent="primary"
      className="min-h-[0]"
      headerSlot={<StatusBadge tone={tone} label={data.health} />}
    >
      <div className="grid gap-2">
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-[16px] border border-[var(--border)] bg-[var(--surface-alt)]/82 px-3 py-2.5">
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <div className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                Local backend
              </div>
              <StatusBadge tone={localBackendOnline ? 'good' : 'critical'} label={localBackendOnline ? 'online' : 'offline'} />
            </div>
            <div className="text-[0.8rem] text-[var(--text)]">{bridgeStatus?.transport ?? 'networktables'}</div>
          </div>

          <div className="rounded-[16px] border border-[var(--border)] bg-[var(--surface-alt)]/82 px-3 py-2.5">
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <div className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                Robot link
              </div>
              <StatusBadge tone={robotLinkOnline ? 'good' : 'warning'} label={robotLinkOnline ? 'connected' : 'waiting'} />
            </div>
            <div className="text-[0.8rem] text-[var(--text)]">{data.routeLabel}</div>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {[
            ['Configured target', configuredHost],
            ['Host seen', data.hostSeen],
            ['Team', bridgeStatus?.teamNumber ? String(bridgeStatus.teamNumber) : String(data.team || '--')],
            ['Chooser', bridgeStatus?.chooserPath ?? 'SmartDashboard/Auto mode'],
          ].map(([label, value]) => (
            <div key={label} className="rounded-[16px] border border-[var(--border)] bg-[var(--surface-alt)]/82 px-3 py-2.5">
              <div className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">{label}</div>
              <div className="mt-1.5 text-[0.8rem] text-[var(--text)]">{value}</div>
            </div>
          ))}
        </div>

        <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface-alt)]/78 px-4 py-4">
          <div className="text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
            Bridge control
          </div>
          <div className="mt-2 text-[0.8rem] leading-6 text-[var(--text-muted)]">
            Hotloop keeps the bridge alive in the background. Use reconnect to refresh the robot link, or set a manual host/IP such as an address, `roborio-1234-frc.local`, or `raspberrypi.local` when you do not want to rely on the default discovery route.
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
            <label className="grid gap-2">
              <span className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                Robot host / IP override
              </span>
              <input
                value={manualHostInput}
                onChange={(event) => setManualHostInput(event.target.value)}
                placeholder="10.12.34.11, roborio-1234-frc.local or raspberrypi.local"
                className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)]/82 px-3 py-2.5 text-[0.82rem] text-[var(--text)] outline-none transition-colors focus:border-[var(--primary)]"
              />
            </label>

            <div className="flex flex-wrap items-end gap-2">
              <button
                type="button"
                onClick={() => void handleApplyHost()}
                disabled={isSubmitting || !localBackendOnline}
                className="rounded-[14px] border border-[var(--primary)]/28 bg-[var(--primary-soft)] px-4 py-2.5 text-[0.74rem] font-semibold uppercase tracking-[0.14em] text-[var(--text)] transition-colors hover:bg-[var(--primary-soft)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Save host
              </button>
              <button
                type="button"
                onClick={() => void handleReconnect()}
                disabled={isSubmitting || (!localBackendOnline && !canRetryLocalBackend)}
                className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)]/84 px-4 py-2.5 text-[0.74rem] font-semibold uppercase tracking-[0.14em] text-[var(--text)] transition-colors hover:bg-[var(--surface)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {localBackendOnline ? 'Reconnect' : 'Retry backend'}
              </button>
              <button
                type="button"
                onClick={() => void handleUseTeamAuto()}
                disabled={isSubmitting || !localBackendOnline}
                className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)]/84 px-4 py-2.5 text-[0.74rem] font-semibold uppercase tracking-[0.14em] text-[var(--text)] transition-colors hover:bg-[var(--surface)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Use team auto
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-[16px] border border-[var(--border)] bg-[var(--surface-alt)]/82 px-3 py-2.5">
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <div className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">AUTOMODE sync</div>
              <StatusBadge tone={syncTone(controlMode?.syncStatus)} label={controlMode?.syncStatus ?? 'unknown'} />
            </div>
            <div className="text-[0.8rem] text-[var(--text)]">{controlMode?.message ?? '--'}</div>
          </div>

          <div className="rounded-[16px] border border-[var(--border)] bg-[var(--surface-alt)]/82 px-3 py-2.5">
            <div className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Backend status</div>
            <div className="mt-1.5 text-[0.8rem] text-[var(--text)]">
              {actionMessage ?? bridgeStatus?.message ?? 'Backend service ready.'}
            </div>
          </div>
        </div>
      </div>
    </DashboardCard>
  )
}
