import { cn } from '../../lib/cn'
import { formatVoltage } from '../../lib/format'
import type { TelemetryDerivedState, TelemetrySnapshot, UiTone } from '../../types/telemetry'
import type { OverviewLayoutId } from '../../preferences/dashboardPreferencesStore'

interface OverviewCardsProps {
  snapshot: TelemetrySnapshot
  derived: TelemetryDerivedState
  layoutMode?: OverviewLayoutId
}

interface OverviewStatusItem {
  label: string
  value: string
  tone: UiTone
}

function pillToneClass(tone: UiTone) {
  if (tone === 'good') {
    return 'border-[var(--success)]/32 bg-[color-mix(in_srgb,var(--success)_14%,var(--surface)_86%)] text-[var(--text)]'
  }

  if (tone === 'warning') {
    return 'border-[var(--warning)]/32 bg-[color-mix(in_srgb,var(--warning)_16%,var(--surface)_84%)] text-[var(--text)]'
  }

  if (tone === 'critical') {
    return 'border-[var(--danger)]/36 bg-[color-mix(in_srgb,var(--danger)_18%,var(--surface)_82%)] text-[var(--text)]'
  }

  if (tone === 'info') {
    return 'border-[var(--primary)]/32 bg-[color-mix(in_srgb,var(--primary)_16%,var(--surface)_84%)] text-[var(--text)]'
  }

  return 'border-[var(--border)] bg-[var(--surface-alt)]/78 text-[var(--text-muted)]'
}

export function OverviewCards({ snapshot, derived, layoutMode = 'balanced' }: OverviewCardsProps) {
  const batteryTone: UiTone =
    snapshot.battery.voltageV <= 0
      ? 'neutral'
      : snapshot.battery.voltageV < 11
        ? 'critical'
        : snapshot.battery.voltageV < 11.8
          ? 'warning'
          : 'good'
  const sensorTone: UiTone =
    snapshot.systems.lidarHealthy && snapshot.systems.validScan && snapshot.systems.navxConnected
      ? 'good'
      : snapshot.systems.lidarHealthy || snapshot.systems.validScan || snapshot.systems.navxConnected
        ? 'warning'
        : 'critical'
  const headingLabel =
    derived.alignmentTone === 'good'
      ? 'aligned'
      : derived.alignmentTone === 'warning'
        ? 'correcting'
        : 'attention'
  const commandActive =
    Math.abs(snapshot.commands.center) > 0.08 ||
    Math.abs(snapshot.commands.forward) > 0.08 ||
    Math.abs(snapshot.commands.rotation) > 0.08

  const items: OverviewStatusItem[] = [
    {
      label: 'Link',
      value: snapshot.connection.online ? 'online' : 'offline',
      tone: derived.connectionTone,
    },
    {
      label: 'Battery',
      value: snapshot.battery.voltageV > 0 ? formatVoltage(snapshot.battery.voltageV, 2) : '--',
      tone: batteryTone,
    },
    {
      label: 'Systems',
      value: sensorTone === 'good' ? 'healthy' : sensorTone === 'warning' ? 'degraded' : 'critical',
      tone: sensorTone,
    },
    {
      label: 'Heading',
      value: headingLabel,
      tone: derived.alignmentTone,
    },
    {
      label: 'Drive',
      value: commandActive ? 'active' : 'hold',
      tone: commandActive ? 'info' : 'neutral',
    },
  ]

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-1.5 rounded-[18px] border border-[var(--border)]/68 bg-[color-mix(in_srgb,var(--surface)_56%,transparent)] px-2 py-1.5',
        layoutMode === 'dataWall' ? 'justify-between' : '',
      )}
    >
      {items.map((item) => (
        <div
          key={item.label}
          className={cn(
            'inline-flex min-w-[118px] items-center gap-2 rounded-full border px-2.5 py-1.5',
            pillToneClass(item.tone),
          )}
        >
          <span
            className={cn(
              'h-2.5 w-2.5 shrink-0 rounded-full',
              item.tone === 'good'
                ? 'bg-[var(--success)]'
                : item.tone === 'warning'
                  ? 'bg-[var(--warning)]'
                  : item.tone === 'critical'
                    ? 'bg-[var(--danger)]'
                    : item.tone === 'info'
                      ? 'bg-[var(--primary)]'
                      : 'bg-[var(--border-strong)]',
            )}
          />
          <div className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] opacity-80">{item.label}</div>
          <div className="truncate text-[0.76rem] font-semibold tracking-[-0.02em]">{item.value}</div>
        </div>
      ))}
    </div>
  )
}
