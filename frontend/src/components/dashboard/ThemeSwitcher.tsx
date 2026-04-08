import { cn } from '../../lib/cn'
import { useTheme } from '../../hooks/useTheme'
import { themes, type ThemeId } from '../../theme/themes'

export function ThemeSwitcher() {
  const { themeId, setThemeId } = useTheme()

  return (
    <div className="inline-flex rounded-full border border-[var(--border)] bg-[var(--surface-alt)] p-1">
      {(Object.keys(themes) as ThemeId[]).map((id) => {
        const theme = themes[id]
        const active = themeId === id

        return (
          <button
            key={theme.id}
            type="button"
            onClick={() => setThemeId(id)}
            className={cn(
              'rounded-full px-3 py-2 text-left transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/45',
              active ? 'bg-[var(--surface-raised)] shadow-[var(--card-shadow)]' : 'hover:bg-[var(--surface)]/60',
            )}
          >
            <span className="block text-[0.76rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
              Theme
            </span>
            <span className="mt-1 block text-sm font-semibold text-[var(--text)]">{theme.label}</span>
          </button>
        )
      })}
    </div>
  )
}
