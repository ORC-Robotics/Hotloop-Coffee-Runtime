import type { CSSProperties } from 'react'
import type { UiTone } from '../../types/telemetry'

interface StatusBadgeProps {
  tone: UiTone
  label: string
}

const toneStyles: Record<UiTone, CSSProperties> = {
  good: {
    background: 'var(--successSoft)',
    color: 'var(--success)',
    borderColor: 'color-mix(in srgb, var(--success) 26%, var(--border))',
  },
  warning: {
    background: 'var(--warningSoft)',
    color: 'var(--warning)',
    borderColor: 'color-mix(in srgb, var(--warning) 28%, var(--border))',
  },
  critical: {
    background: 'var(--dangerSoft)',
    color: 'var(--danger)',
    borderColor: 'color-mix(in srgb, var(--danger) 30%, var(--border))',
  },
  info: {
    background: 'var(--infoSoft)',
    color: 'var(--info)',
    borderColor: 'color-mix(in srgb, var(--info) 28%, var(--border))',
  },
  neutral: {
    background: 'var(--surface-alt)',
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
