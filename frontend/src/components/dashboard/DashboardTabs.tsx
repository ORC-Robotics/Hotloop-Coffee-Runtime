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

export function DashboardTabs({ activeTab, onChange }: DashboardTabsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((tab) => {
        const active = tab.id === activeTab

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              'rounded-full border px-4 py-2 text-left transition-colors',
              active
                ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--text)]'
                : 'border-[var(--border)] bg-[var(--surface)]/86 text-[var(--text-muted)] hover:bg-[var(--surface-alt)]',
            )}
            style={{ boxShadow: active ? 'var(--card-shadow)' : undefined }}
          >
            <div className="text-[0.76rem] font-semibold uppercase tracking-[0.16em]">{tab.label}</div>
            <div className="mt-0.5 text-[0.72rem] tracking-[0.02em] opacity-85">{tab.hint}</div>
          </button>
        )
      })}
    </div>
  )
}
