import { cn } from '../../lib/cn'
import { useTelemetryMode } from '../../telemetry-mode/useTelemetryMode'
import type { TelemetryMode } from '../../telemetry-mode/telemetryModeStore'

const options: Array<{ id: TelemetryMode; label: string }> = [
  { id: 'online', label: 'Online' },
  { id: 'offline', label: 'Simulation' },
]

export function TelemetryModeToggle() {
  const { mode, setMode } = useTelemetryMode()

  return (
    <div className="inline-flex items-center gap-1 rounded-[16px] border border-[var(--border)] bg-[var(--surface-alt)]/76 p-1">
      {options.map((option) => {
        const active = option.id === mode

        return (
          <button
            key={option.id}
            type="button"
            onClick={() => setMode(option.id)}
            className={cn(
              'rounded-[12px] px-3 py-2 text-[0.68rem] font-semibold uppercase tracking-[0.14em] transition-colors',
              active
                ? option.id === 'online'
                  ? 'bg-[color-mix(in_srgb,var(--success)_14%,var(--surface)_86%)] text-[var(--text)]'
                  : 'bg-[color-mix(in_srgb,var(--warning)_16%,var(--surface)_84%)] text-[var(--text)]'
                : 'text-[var(--text-muted)] hover:bg-[var(--surface)] hover:text-[var(--text)]',
            )}
            aria-pressed={active}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
