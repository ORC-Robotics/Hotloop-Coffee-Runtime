import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useDashboardPreferences } from '../../preferences/useDashboardPreferences'
import type {
  CameraFeedConfig,
  CameraFeedKind,
  DiagnosticsLayoutId,
  OverviewLayoutId,
  SystemsLayoutId,
  UiScaleId,
} from '../../preferences/dashboardPreferencesStore'
import { useTheme } from '../../hooks/useTheme'
import { cn } from '../../lib/cn'
import { themes, type ThemeId } from '../../theme/themes'
import { StatusBadge } from './StatusBadge'

const uiScaleOptions: Array<{ id: UiScaleId; label: string; hint: string }> = [
  { id: 'compact', label: 'Compact', hint: 'Fit more telemetry in the same viewport.' },
  { id: 'standard', label: 'Standard', hint: 'Balanced size for everyday operation.' },
  { id: 'large', label: 'Large', hint: 'Bigger text for pit tuning and manual tests.' },
]

const overviewLayoutOptions: Array<{ id: OverviewLayoutId; label: string }> = [
  { id: 'balanced', label: 'Balanced' },
  { id: 'pilot', label: 'Pilot Focus' },
  { id: 'dataWall', label: 'Data Wall' },
]

const diagnosticsLayoutOptions: Array<{ id: DiagnosticsLayoutId; label: string }> = [
  { id: 'split', label: 'Split' },
  { id: 'deepDive', label: 'Deep Dive' },
]

const systemsLayoutOptions: Array<{ id: SystemsLayoutId; label: string }> = [
  { id: 'wide', label: 'Wide' },
  { id: 'stacked', label: 'Stacked' },
  { id: 'cameraFocus', label: 'Camera Focus' },
]

const cameraKinds: Array<{ id: CameraFeedKind; label: string }> = [
  { id: 'mjpeg', label: 'MJPEG / stream' },
  { id: 'snapshot', label: 'Snapshot / JPEG' },
  { id: 'video', label: 'Video / MP4' },
]

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.7">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10.325 4.317a1.724 1.724 0 0 1 3.35 0 1.724 1.724 0 0 0 2.574 1.066 1.724 1.724 0 0 1 2.48 2.48 1.724 1.724 0 0 0 1.065 2.574 1.724 1.724 0 0 1 0 3.35 1.724 1.724 0 0 0-1.066 2.574 1.724 1.724 0 0 1-2.48 2.48 1.724 1.724 0 0 0-2.574 1.065 1.724 1.724 0 0 1-3.35 0 1.724 1.724 0 0 0-2.574-1.066 1.724 1.724 0 0 1-2.48-2.48 1.724 1.724 0 0 0-1.065-2.574 1.724 1.724 0 0 1 0-3.35 1.724 1.724 0 0 0 1.066-2.574 1.724 1.724 0 0 1 2.48-2.48 1.724 1.724 0 0 0 2.574-1.065Z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  )
}

function ThemeSwatch({
  id,
  active,
  onClick,
}: {
  id: ThemeId
  active: boolean
  onClick: () => void
}) {
  const theme = themes[id]

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'grid gap-2 rounded-[20px] border p-3 text-left transition-colors',
        active
          ? 'border-[var(--primary)] bg-[var(--primary-soft)]/72'
          : 'border-[var(--border)] bg-[var(--surface-alt)]/76 hover:bg-[var(--surface-alt)]',
      )}
    >
      <div className="flex gap-2">
        {[theme.tokens.bgPrimary, theme.tokens.bgSurface, theme.tokens.accentPrimary, theme.tokens.accentSecondary].map((color) => (
          <span key={color} className="h-7 flex-1 rounded-full border border-[var(--border)]/60" style={{ backgroundColor: color }} />
        ))}
      </div>
      <div className="text-[0.8rem] font-semibold text-[var(--text)]">{theme.label}</div>
      <div className="text-[0.74rem] leading-5 text-[var(--text-muted)]">{theme.description}</div>
    </button>
  )
}

function LabeledSelect<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: {
  label: string
  value: T
  options: Array<{ id: T; label: string }>
  onChange: (value: T) => void
  disabled?: boolean
}) {
  return (
    <label className="grid gap-2">
      <span className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        disabled={disabled}
        className="rounded-[16px] border border-[var(--border)] bg-[var(--surface-alt)]/82 px-3 py-3 text-[0.84rem] text-[var(--text)] outline-none transition-colors focus:border-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function CameraFeedEditor({
  feed,
  onChange,
}: {
  feed: CameraFeedConfig
  onChange: (patch: Partial<CameraFeedConfig>) => void
}) {
  return (
    <div className="grid gap-3 rounded-[20px] border border-[var(--border)] bg-[var(--surface-alt)]/76 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[0.76rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
            {feed.label}
          </div>
          <div className="mt-1 text-[0.8rem] text-[var(--text-muted)]">
            Use a robot MJPEG URL, a snapshot endpoint or a direct video file.
          </div>
        </div>

        <label className="flex items-center gap-2 text-[0.78rem] text-[var(--text)]">
          <input
            type="checkbox"
            checked={feed.enabled}
            onChange={(event) => onChange({ enabled: event.target.checked })}
            className="h-4 w-4 accent-[var(--primary)]"
          />
          Enabled
        </label>
      </div>

      <label className="grid gap-2">
        <span className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Label</span>
        <input
          value={feed.label}
          onChange={(event) => onChange({ label: event.target.value })}
          className="rounded-[16px] border border-[var(--border)] bg-[var(--surface)]/82 px-3 py-3 text-[0.84rem] text-[var(--text)] outline-none transition-colors focus:border-[var(--primary)]"
        />
      </label>

      <label className="grid gap-2">
        <span className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Stream URL</span>
        <input
          value={feed.url}
          onChange={(event) => onChange({ url: event.target.value })}
          placeholder="http://10.12.34.11:1181/stream.mjpg"
          className="rounded-[16px] border border-[var(--border)] bg-[var(--surface)]/82 px-3 py-3 text-[0.84rem] text-[var(--text)] outline-none transition-colors focus:border-[var(--primary)]"
        />
      </label>

      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,160px)]">
        <LabeledSelect
          label="Feed type"
          value={feed.kind}
          options={cameraKinds}
          onChange={(value) => onChange({ kind: value })}
        />

        <label className="grid gap-2">
          <span className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Snapshot refresh</span>
          <input
            type="number"
            value={feed.refreshMs}
            min={250}
            step={50}
            onChange={(event) => onChange({ refreshMs: Number(event.target.value) || 900 })}
            className="rounded-[16px] border border-[var(--border)] bg-[var(--surface)]/82 px-3 py-3 text-[0.84rem] text-[var(--text)] outline-none transition-colors focus:border-[var(--primary)]"
          />
        </label>
      </div>
    </div>
  )
}

export function DashboardSettingsLauncher() {
  const [open, setOpen] = useState(false)
  const { themeId, setThemeId } = useTheme()
  const {
    preferences,
    setLayoutSetting,
    resetLayout,
    updateCameraFeed,
  } = useDashboardPreferences()

  const layoutLocked = preferences.layout.layoutLocked
  const canPortal = typeof document !== 'undefined'

  useEffect(() => {
    if (!open || !canPortal) {
      return
    }

    const previousOverflow = document.body.style.overflow
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [canPortal, open])

  const settingsOverlay =
    open && canPortal
      ? createPortal(
          <div className="fixed inset-0 z-[120]">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute inset-0 h-full w-full bg-black/34 backdrop-blur-[3px]"
              aria-label="Close settings overlay"
            />

            <aside className="absolute inset-y-0 right-0 z-[121] flex w-full max-w-[560px] flex-col border-l border-[var(--border)] bg-[var(--surface)]/96 p-4 backdrop-blur-md" style={{ boxShadow: 'var(--card-shadow-strong)' }}>
              <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] pb-4">
                <div>
                  <div className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                    Dashboard Settings
                  </div>
                  <div className="mt-1 text-[1.2rem] font-semibold tracking-[-0.04em] text-[var(--text)]">
                    Themes, layout scale and camera slots
                  </div>
                  <div className="mt-1 text-[0.82rem] leading-6 text-[var(--text-muted)]">
                    Everything here is saved locally for this operator station.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-full border border-[var(--border)] bg-[var(--surface-alt)]/76 px-4 py-2 text-[0.74rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-alt)]"
                >
                  Close
                </button>
              </div>

              <div className="mt-4 flex-1 space-y-4 overflow-auto pr-1">
                <section className="grid gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                        Appearance
                      </div>
                      <div className="mt-1 text-[0.9rem] text-[var(--text)]">Switch the whole dashboard mood without exposing the selector in the top bar.</div>
                    </div>
                    <StatusBadge tone="info" label={themes[themeId].label} />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {(Object.keys(themes) as ThemeId[]).map((id) => (
                      <ThemeSwatch key={id} id={id} active={themeId === id} onClick={() => setThemeId(id)} />
                    ))}
                  </div>
                </section>

                <section className="grid gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                        Layout Settings
                      </div>
                      <div className="mt-1 text-[0.9rem] text-[var(--text)]">
                        The factory layout is the only baseline. Fine tune the pages directly and reset when needed.
                      </div>
                    </div>
                    <label className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-alt)]/76 px-3 py-2 text-[0.76rem] text-[var(--text)]">
                      <input
                        type="checkbox"
                        checked={layoutLocked}
                        onChange={(event) => setLayoutSetting('layoutLocked', event.target.checked)}
                        className="h-4 w-4 accent-[var(--primary)]"
                      />
                      Lock layout
                    </label>
                  </div>

                  <div className="grid gap-3 rounded-[20px] border border-[var(--border)] bg-[var(--surface-alt)]/76 p-4 md:grid-cols-2">
                    <LabeledSelect
                      label="Data scale"
                      value={preferences.layout.uiScale}
                      options={uiScaleOptions.map(({ id, label }) => ({ id, label }))}
                      onChange={(value) => setLayoutSetting('uiScale', value)}
                      disabled={layoutLocked}
                    />
                    <LabeledSelect
                      label="Overview layout"
                      value={preferences.layout.overviewLayout}
                      options={overviewLayoutOptions}
                      onChange={(value) => setLayoutSetting('overviewLayout', value)}
                      disabled={layoutLocked}
                    />
                    <LabeledSelect
                      label="Diagnostics layout"
                      value={preferences.layout.diagnosticsLayout}
                      options={diagnosticsLayoutOptions}
                      onChange={(value) => setLayoutSetting('diagnosticsLayout', value)}
                      disabled={layoutLocked}
                    />
                    <LabeledSelect
                      label="Systems layout"
                      value={preferences.layout.systemsLayout}
                      options={systemsLayoutOptions}
                      onChange={(value) => setLayoutSetting('systemsLayout', value)}
                      disabled={layoutLocked}
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-[var(--border)] bg-[var(--surface-alt)]/76 p-4">
                    <label className="flex items-center gap-3 text-[0.84rem] text-[var(--text)]">
                      <input
                        type="checkbox"
                        checked={preferences.layout.showCameraInSystems}
                        onChange={(event) => setLayoutSetting('showCameraInSystems', event.target.checked)}
                        disabled={layoutLocked}
                        className="h-4 w-4 accent-[var(--primary)]"
                      />
                      Show camera viewport inside the Systems page when a feed exists
                    </label>

                    <button
                      type="button"
                      onClick={resetLayout}
                      className="rounded-full border border-[var(--border)] bg-[var(--surface)]/76 px-4 py-2 text-[0.74rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)] transition-colors hover:bg-[var(--surface)]"
                    >
                      Reset to factory
                    </button>
                  </div>
                </section>

                <section className="grid gap-3">
                  <div>
                    <div className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                      Camera Feeds
                    </div>
                    <div className="mt-1 text-[0.9rem] text-[var(--text)]">
                      Atlas ainda nao publica live view automaticamente, mas o ORION ja aceita stream manual por URL e abre uma viewport dedicada.
                    </div>
                  </div>

                  <div className="space-y-3">
                    {preferences.cameraFeeds.map((feed) => (
                      <CameraFeedEditor
                        key={feed.id}
                        feed={feed}
                        onChange={(patch) => updateCameraFeed(feed.id, patch)}
                      />
                    ))}
                  </div>
                </section>
              </div>
            </aside>
          </div>,
          document.body,
        )
      : null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-[14px] border border-[var(--border)] bg-[var(--surface-alt)]/80 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text)]"
        aria-label="Open dashboard settings"
      >
        <GearIcon />
      </button>
      {settingsOverlay}
    </>
  )
}
