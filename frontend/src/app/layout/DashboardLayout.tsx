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
    <div className="min-h-screen bg-[var(--background)] text-[var(--text)]">
      <div className="mx-auto flex min-h-screen max-w-[1880px] flex-col gap-3 px-3 py-3 xl:px-4 xl:py-4">
        {topBar}
        {overview}
        {tabBar}
        <div className="flex-1 min-h-0">{main}</div>
      </div>
    </div>
  )
}
