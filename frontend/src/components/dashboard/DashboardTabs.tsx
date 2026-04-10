import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export type DashboardTabId = 'overview' | 'diagnostics' | 'systems' | 'debug'

interface DashboardTabsProps {
  activeTab: DashboardTabId
  onChange: (tab: DashboardTabId) => void
}

const tabs: Array<{ id: DashboardTabId; label: string; hint: string }> = [
  { id: 'overview', label: 'Overview', hint: 'operational focus' },
  { id: 'diagnostics', label: 'Diagnostics', hint: 'encoders and route' },
  { id: 'systems', label: 'Systems', hint: 'sensor chain' },
  { id: 'debug', label: 'Debug', hint: 'future expansion' },
]

function OverviewIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.8">
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <path d="M7.5 15.5h3M13 12.5h3.5M7.5 9.5H16" />
    </svg>
  )
}

function DiagnosticsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.8">
      <path d="M4 18.5h16M6.5 15.5l3.25-3.25 2.5 2.5L17.5 9.5" />
      <circle cx="17.5" cy="9.5" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  )
}

function SystemsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.8">
      <path d="M12 5.5v13M5.5 12h13" />
      <circle cx="12" cy="12" r="7.5" />
      <circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none" />
    </svg>
  )
}

function DebugIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.8">
      <path d="M9.5 8 6.5 12l3 4M14.5 16h3M8.5 4.5l-2-2M15.5 4.5l2-2M8 18.5l-2 2M16 18.5l2 2" />
      <rect x="6.5" y="6.5" width="11" height="11" rx="3.5" />
    </svg>
  )
}

const tabIcons: Record<DashboardTabId, () => ReactNode> = {
  overview: OverviewIcon,
  diagnostics: DiagnosticsIcon,
  systems: SystemsIcon,
  debug: DebugIcon,
}

export function DashboardTabs({ activeTab, onChange }: DashboardTabsProps) {
  return (
    <nav
      className="rounded-[18px] border border-[var(--border)]/72 bg-[color-mix(in_srgb,var(--surface)_88%,var(--background)_12%)] p-1.5"
      style={{ boxShadow: 'var(--card-shadow)' }}
      aria-label="Primary dashboard views"
    >
      <div className="flex flex-wrap gap-1.5">
        {tabs.map((tab) => {
          const active = tab.id === activeTab
          const Icon = tabIcons[tab.id]

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              title={tab.hint}
              className={cn(
                'group inline-flex min-w-[132px] items-center gap-2 rounded-[12px] border px-3 py-2 text-left transition-colors',
                active
                  ? 'border-[var(--primary)]/36 bg-[color-mix(in_srgb,var(--primary)_16%,var(--surface)_84%)] text-[var(--text)]'
                  : 'border-[var(--border)] bg-[var(--surface-alt)]/72 text-[var(--text-muted)] hover:bg-[var(--surface-alt)] hover:text-[var(--text)]',
              )}
              style={{ boxShadow: active ? 'var(--card-shadow)' : undefined }}
              aria-pressed={active}
            >
              <span
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-[10px] border transition-colors',
                  active
                    ? 'border-[var(--primary)]/24 bg-[var(--primary-soft)] text-[var(--primary)]'
                    : 'border-[var(--border)] bg-[var(--surface)]/82 text-[var(--text-muted)] group-hover:text-[var(--text)]',
                )}
              >
                <Icon />
              </span>

              <span className="min-w-0">
                <span className="block text-[0.72rem] font-semibold uppercase tracking-[0.14em]">{tab.label}</span>
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
