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
  const accentGlow = `linear-gradient(180deg, color-mix(in srgb, ${accentColor} 14%, transparent) 0%, transparent 100%)`

  return (
    <section
      className={cn(
        'relative flex h-full min-h-0 flex-col overflow-hidden rounded-[24px] border border-[var(--border-strong)]/75 bg-[color-mix(in_srgb,var(--surface)_90%,var(--background)_10%)] backdrop-blur-md',
        className,
      )}
      style={{ boxShadow: 'var(--card-shadow)' }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-20 opacity-80"
        style={{ background: accentGlow } satisfies CSSProperties}
      />

      <header className="relative z-[1] flex items-start justify-between gap-3 border-b border-[var(--border)]/85 px-4 py-3.5 xl:px-5">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: accentColor } satisfies CSSProperties}
            />
            {subtitle ? (
              <p className="text-[0.69rem] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                {subtitle}
              </p>
            ) : (
              <span
                className="h-px w-10 rounded-full opacity-80"
                style={{ background: accentColor } satisfies CSSProperties}
              />
            )}
          </div>
          <h2 className="text-[clamp(0.98rem,0.9rem+0.28vw,1.22rem)] font-semibold tracking-[-0.02em] text-[var(--text)]">
            {title}
          </h2>
        </div>
        {headerSlot}
      </header>
      <div className={cn('relative z-[1] min-h-0 flex-1 px-4 py-4 xl:px-5', bodyClassName)}>{children}</div>
    </section>
  )
}
