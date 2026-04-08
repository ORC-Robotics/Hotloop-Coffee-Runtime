import type { CSSProperties, PropsWithChildren, ReactNode } from 'react'
import { cn } from '../../lib/cn'

type AccentTone = 'primary' | 'accent' | 'success' | 'warning' | 'danger' | 'info'

const accentMap: Record<AccentTone, string> = {
  primary: 'var(--primary)',
  accent: 'var(--accent)',
  success: 'var(--success)',
  warning: 'var(--warning)',
  danger: 'var(--danger)',
  info: 'var(--info)',
}

interface DashboardCardProps extends PropsWithChildren {
  title: string
  subtitle?: string
  accent?: AccentTone
  headerSlot?: ReactNode
  className?: string
  bodyClassName?: string
}

export function DashboardCard({
  title,
  subtitle,
  accent = 'primary',
  headerSlot,
  className,
  bodyClassName,
  children,
}: DashboardCardProps) {
  const accentColor = accentMap[accent]

  return (
    <section
      className={cn(
        'flex h-full min-h-0 flex-col overflow-hidden rounded-[24px] border border-[var(--border)] bg-[var(--surface)]/92 backdrop-blur-sm',
        className,
      )}
      style={{ boxShadow: 'var(--card-shadow)' }}
    >
      <header className="flex items-start justify-between gap-3 border-b border-[var(--border)]/80 px-4 py-3">
        <div className="min-w-0">
          <div
            className="mb-2 h-1.5 w-12 rounded-full"
            style={{ background: accentColor } satisfies CSSProperties}
          />
          <h2 className="text-[clamp(0.98rem,0.9rem+0.28vw,1.22rem)] font-semibold tracking-[-0.02em] text-[var(--text)]">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-1 text-[0.69rem] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
              {subtitle}
            </p>
          ) : null}
        </div>
        {headerSlot}
      </header>
      <div className={cn('min-h-0 flex-1 px-4 py-3', bodyClassName)}>{children}</div>
    </section>
  )
}
