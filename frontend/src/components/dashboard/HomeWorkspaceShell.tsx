import { useEffect, useRef, useState } from 'react'
import { cn } from '../../lib/cn'
import { formatClock } from '../../lib/format'
import { useTelemetryCatalog } from '../../hooks/useTelemetryCatalog'
import { useHomeWorkspace } from '../../home-workspace/useHomeWorkspace'
import type { TelemetryTopic } from '../../types/telemetry'
import { HomeWorkspaceCanvas } from './home-workspace/HomeWorkspaceCanvas'
import type { WorkspaceHistoryPoint } from './home-workspace/HomeWorkspaceWidgetRenderer'

const HISTORY_LIMIT = 64

function getNumericTopicValue(topic: TelemetryTopic | null) {
  if (!topic || topic.valueKind !== 'number' || typeof topic.value !== 'number' || !Number.isFinite(topic.value)) {
    return null
  }

  return topic.value
}

function WorkspaceActionButton({
  children,
  onClick,
  disabled = false,
  active = false,
}: {
  children: string
  onClick: () => void
  disabled?: boolean
  active?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'rounded-full border px-3 py-1.5 text-[0.66rem] font-semibold uppercase tracking-[0.14em] transition-colors',
        disabled
          ? 'cursor-default border-[var(--border)] bg-[var(--surface)]/76 text-[var(--text-muted)]'
          : active
            ? 'border-[var(--primary)] bg-[var(--primary-soft)]/84 text-[var(--text)]'
            : 'border-[var(--border)] bg-[var(--surface-alt)]/80 text-[var(--text)] hover:bg-[var(--surface)]',
      )}
    >
      {children}
    </button>
  )
}

function WorkspacePageTab({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.14em] transition-colors',
        active
          ? 'border-[var(--primary)]/34 bg-[color-mix(in_srgb,var(--primary)_16%,var(--surface)_84%)] text-[var(--text)]'
          : 'border-[var(--border)] bg-[var(--surface-alt)]/72 text-[var(--text-muted)] hover:bg-[var(--surface)] hover:text-[var(--text)]',
      )}
    >
      {label}
    </button>
  )
}

export function HomeWorkspaceShell() {
  const {
    workspace,
    activePage,
    canAddPage,
    setActivePage,
    renamePage,
    addPage,
    removePage,
    addWidgetToActivePage,
    removeWidget,
    updateWidget,
    moveWidget,
    resizeWidget,
    clearActivePage,
  } = useHomeWorkspace()
  const [editMode, setEditMode] = useState(true)
  const [historyByTopic, setHistoryByTopic] = useState<Record<string, WorkspaceHistoryPoint[]>>({})
  const widgetTopicKeysRef = useRef<string[]>([])

  useEffect(() => {
    widgetTopicKeysRef.current = workspace.pages.flatMap((page) =>
      page.widgets.flatMap((widget) => (widget.topicKey ? [widget.topicKey] : [])),
    )
  }, [workspace.pages])

  const catalog = useTelemetryCatalog((incoming) => {
    setHistoryByTopic((current) => {
      const trackedKeys = new Set(widgetTopicKeysRef.current)
      const incomingTopicMap = new Map(incoming.topics.map((topic) => [topic.key, topic]))
      let changed = false
      const next: Record<string, WorkspaceHistoryPoint[]> = {}

      for (const key of trackedKeys) {
        const previousHistory = current[key] ?? []
        const topic = incomingTopicMap.get(key) ?? null
        const value = getNumericTopicValue(topic)

        if (value === null) {
          if (previousHistory.length) {
            next[key] = previousHistory
          }
          continue
        }

        const lastPoint = previousHistory[previousHistory.length - 1]
        if (lastPoint && lastPoint.timestamp === incoming.timestamp) {
          next[key] = previousHistory
          continue
        }

        next[key] = [...previousHistory, { timestamp: incoming.timestamp, value }].slice(-HISTORY_LIMIT)
        changed = true
      }

      if (Object.keys(current).some((key) => !trackedKeys.has(key))) {
        changed = true
      }

      return changed ? next : current
    })
  })

  return (
    <section
      className="relative flex h-full min-h-[560px] min-w-0 flex-col overflow-hidden rounded-[28px] border border-[var(--border-strong)]/70 bg-[color-mix(in_srgb,var(--surface)_74%,var(--background)_26%)]"
      style={{ boxShadow: 'var(--card-shadow-strong)' }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'linear-gradient(to right, var(--grid-line) 1px, transparent 1px), linear-gradient(to bottom, var(--grid-line) 1px, transparent 1px)',
          backgroundSize: '42px 42px',
        }}
      />

      <div className="relative z-[1] flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)]/72 px-4 py-3 xl:px-5">
        <div className="min-w-0">
          <div className="text-[0.66rem] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
            Home Workspace
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h2 className="truncate text-[1.04rem] tracking-[-0.04em] text-[var(--text)]">
              Operator widget builder
            </h2>
            <div className="rounded-full border border-[var(--border)] bg-[var(--surface)]/74 px-2.5 py-1 text-[0.64rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
              Saved {formatClock(workspace.lastSavedAt)}
            </div>
            <div className="rounded-full border border-[var(--border)] bg-[var(--surface)]/74 px-2.5 py-1 text-[0.64rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
              {catalog.topics.length} live topics
            </div>
          </div>
          <div className="mt-2 max-w-[66ch] text-[0.8rem] leading-6 text-[var(--text-muted)]">
            Widgets now store their own topic, renderer, position, width, height and formatting rules. Drag to reposition, resize on the lower-right handle, and keep each page saved locally.
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <WorkspaceActionButton onClick={addWidgetToActivePage}>Add widget</WorkspaceActionButton>
          <WorkspaceActionButton onClick={() => setEditMode((current) => !current)} active={editMode}>
            {editMode ? 'Builder On' : 'Builder Off'}
          </WorkspaceActionButton>
          <WorkspaceActionButton onClick={addPage} disabled={!canAddPage}>New page</WorkspaceActionButton>
          <WorkspaceActionButton onClick={clearActivePage} disabled={activePage.widgets.length === 0}>
            Clear page
          </WorkspaceActionButton>
        </div>
      </div>

      <div className="relative z-[1] flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)]/65 px-4 py-2 xl:px-5">
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
          {workspace.pages.map((page) => (
            <WorkspacePageTab
              key={page.id}
              active={page.id === activePage.id}
              label={page.title}
              onClick={() => setActivePage(page.id)}
            />
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            value={activePage.title}
            onChange={(event) => renamePage(activePage.id, event.target.value)}
            className="min-w-[140px] rounded-full border border-[var(--border)] bg-[var(--surface)]/84 px-3 py-1.5 text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-[var(--text)] outline-none transition-colors focus:border-[var(--primary)]"
            aria-label="Rename workspace page"
          />
          <div className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
            {activePage.widgets.length} widgets
          </div>
          <WorkspaceActionButton
            onClick={() => removePage(activePage.id)}
            disabled={workspace.pages.length <= 1}
          >
            Remove page
          </WorkspaceActionButton>
        </div>
      </div>

      <div className="relative z-[1] flex-1 min-h-0 p-4 xl:p-5">
        {activePage.widgets.length ? (
          <HomeWorkspaceCanvas
            widgets={activePage.widgets}
            topics={catalog.topics}
            historyByTopic={historyByTopic}
            editMode={editMode}
            onUpdateWidget={updateWidget}
            onRemoveWidget={removeWidget}
            onMoveWidget={moveWidget}
            onResizeWidget={resizeWidget}
          />
        ) : (
          <div className="flex h-full min-h-[420px] flex-col items-center justify-center rounded-[24px] border border-dashed border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_42%,transparent)] px-6 py-8 text-center">
            <div className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
              {activePage.title}
            </div>
            <div className="mt-3 text-[clamp(1.2rem,1.04rem+0.48vw,1.72rem)] tracking-[-0.05em] text-[var(--text)]">
              This page is ready for custom widgets
            </div>
            <div className="mt-3 max-w-[56ch] text-[0.88rem] leading-7 text-[var(--text-muted)]">
              Start with an empty widget, bind it to a live topic, then choose the renderer that best fits the data type. Each widget keeps its own layout, size, thresholds and formatting rules without pushing legacy panels back onto the home screen.
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <WorkspaceActionButton onClick={addWidgetToActivePage}>Add first widget</WorkspaceActionButton>
              <WorkspaceActionButton onClick={addPage} disabled={!canAddPage}>Create another page</WorkspaceActionButton>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
