import type { CSSProperties } from 'react'
import type { UiTone } from '../../types/telemetry'

interface StatusBadgeProps {
  tone: UiTone
  label: string
}

const toneStyles: Record<UiTone, CSSProperties> = {
  good: {
    background: 'var(--status-success-soft)',
    color: 'var(--status-success)',
    borderColor: 'color-mix(in srgb, var(--status-success) 26%, var(--border))',
  },
  warning: {
    background: 'var(--status-warning-soft)',
    color: 'var(--status-warning)',
    borderColor: 'color-mix(in srgb, var(--status-warning) 28%, var(--border))',
  },
  critical: {
    background: 'var(--status-error-soft)',
    color: 'var(--status-error)',
    borderColor: 'color-mix(in srgb, var(--status-error) 30%, var(--border))',
  },
  info: {
    background: 'var(--status-info-soft)',
    color: 'var(--status-info)',
    borderColor: 'color-mix(in srgb, var(--status-info) 28%, var(--border))',
  },
  neutral: {
    background: 'var(--bg-elevated)',
    color: 'var(--text-muted)',
    borderColor: 'var(--border)',
  },
}

export function StatusBadge({ tone, label }: StatusBadgeProps) {
  return (
    <span
      className="inline-flex items-center rounded-full border px-3 py-1 text-[0.73rem] font-semibold uppercase tracking-[0.16em]"
      style={toneStyles[tone]}
    >
      {label}
    </span>
  )
}
