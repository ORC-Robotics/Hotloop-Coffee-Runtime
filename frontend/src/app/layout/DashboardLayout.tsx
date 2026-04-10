import type { ReactNode } from 'react'

interface DashboardLayoutProps {
  topBar: ReactNode
  overview: ReactNode
  tabBar: ReactNode
  main: ReactNode
}

export function DashboardLayout({
  topBar,
  overview,
  tabBar,
  main,
}: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="mx-auto flex min-h-screen max-w-[1920px] flex-col gap-2.5 px-2.5 py-2.5 xl:gap-3 xl:px-3 xl:py-3">
        {topBar}
        {overview}

        <section
          className="grid min-h-0 flex-1 gap-2.5 rounded-[24px] border border-[var(--border)]/68 bg-[color-mix(in_srgb,var(--bg-surface)_86%,transparent)] p-2.5 xl:p-3"
          style={{ boxShadow: 'var(--card-shadow)' }}
        >
          {tabBar}
          <div className="flex-1 min-h-0">{main}</div>
        </section>
      </div>
    </div>
  )
}
