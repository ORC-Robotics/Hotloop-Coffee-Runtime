import {
  type CSSProperties,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../../../lib/cn'
import { resolveActiveCameraFeeds } from '../../../lib/cameraFeeds'
import { useDashboardPreferences } from '../../../preferences/useDashboardPreferences'
import {
  HOME_WORKSPACE_GRID_COLUMNS,
  HOME_WORKSPACE_GRID_GAP_PX,
  HOME_WORKSPACE_GRID_ROW_PX,
  getHomeWorkspaceWidgetMaxSize,
  getHomeWorkspaceWidgetMinSize,
  type HomeWorkspacePresetWidgetConfig,
  type HomeWorkspaceWidgetConfig,
  type HomeWorkspaceWidgetRenderer as HomeWorkspaceRendererId,
  isHomeWorkspacePresetWidget,
  isHomeWorkspaceTopicWidget,
  type HomeWorkspaceWidget,
} from '../../../home-workspace/homeWorkspaceStore'
import { getHomeWorkspacePresetDefinition } from '../../../home-workspace/homeWorkspacePresets'
import type {
  AlertItem,
  BatteryHistoryPoint,
  TelemetryDerivedState,
  TelemetrySnapshot,
  TelemetryTopic,
} from '../../../types/telemetry'
import {
  HomeWorkspaceWidgetRenderer,
  allowedWidgetRenderers,
  suggestedWidgetTitle,
  widgetRendererLabel,
  type WorkspaceHistoryPoint,
} from './HomeWorkspaceWidgetRenderer'
import { TelemetryTopicBrowser, type TelemetryTopicScopeFilter } from '../TelemetryTopicBrowser'

interface HomeWorkspaceCanvasProps {
  alerts: AlertItem[]
  batteryHistory: BatteryHistoryPoint[]
  derived: TelemetryDerivedState
  widgets: HomeWorkspaceWidget[]
  topics: TelemetryTopic[]
  historyByTopic: Record<string, WorkspaceHistoryPoint[]>
  editMode: boolean
  snapshot: TelemetrySnapshot
  onUpdateWidget: (
    widgetId: string,
    patch: {
      title?: string
      topicKey?: string | null
      renderer?: HomeWorkspaceRendererId
      config?: Partial<HomeWorkspaceWidgetConfig>
      presetConfig?: Partial<HomeWorkspacePresetWidgetConfig>
    },
  ) => void
  onRemoveWidget: (widgetId: string) => void
  onMoveWidget: (widgetId: string, x: number, y: number) => void
  onResizeWidget: (widgetId: string, w: number, h: number) => void
}

interface InteractionState {
  kind: 'move' | 'resize'
  widgetId: string
  startClientX: number
  startClientY: number
  minH: number
  minW: number
  maxH: number
  maxW: number
  startRect: Pick<HomeWorkspaceWidget, 'x' | 'y' | 'w' | 'h'>
  previewRect: Pick<HomeWorkspaceWidget, 'x' | 'y' | 'w' | 'h'>
  cellWidth: number
}

const UNBOUND_RENDERER_OPTIONS: HomeWorkspaceRendererId[] = [
  'auto',
  'boolean-button',
  'boolean-light',
  'boolean-pill',
  'boolean-tile',
  'text-line',
  'text-tile',
]

function clampSize(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)))
}

function ToolbarButton({
  children,
  onClick,
  active = false,
  title,
}: {
  children: string
  onClick: () => void
  active?: boolean
  title?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        'rounded-full border px-2.5 py-1.5 text-[0.64rem] font-semibold uppercase tracking-[0.14em] transition-colors',
        active
          ? 'border-[var(--primary)] bg-[var(--primary-soft)]/84 text-[var(--text)]'
          : 'border-[var(--border)] bg-[var(--surface)]/82 text-[var(--text-muted)] hover:bg-[var(--surface-alt)] hover:text-[var(--text)]',
      )}
    >
      {children}
    </button>
  )
}

function ConfigureButton({
  onClick,
}: {
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Configure widget"
      title="Configure widget"
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)]/82 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-alt)] hover:text-[var(--text)]"
    >
      <svg
        viewBox="0 0 20 20"
        aria-hidden="true"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path
          d="M10 3.5l1 .55 1.14-.26.74.9-.4 1.08.62 1 .98.35v1.26l-.98.35-.62 1 .4 1.08-.74.9-1.14-.26-1 .55-1-.55-1.14.26-.74-.9.4-1.08-.62-1-.98-.35V7.12l.98-.35.62-1-.4-1.08.74-.9 1.14.26 1-.55z"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="10" cy="10" r="2.35" />
      </svg>
    </button>
  )
}

function QuickRemoveButton({
  onClick,
}: {
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Remove widget"
      title="Remove widget"
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[color-mix(in_srgb,var(--danger)_28%,var(--border)_72%)] bg-[color-mix(in_srgb,var(--danger)_14%,var(--surface)_86%)] text-[var(--danger)] transition-colors hover:bg-[color-mix(in_srgb,var(--danger)_20%,var(--surface)_80%)]"
    >
      <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M6.5 6.5l7 7M13.5 6.5l-7 7" strokeLinecap="round" />
      </svg>
    </button>
  )
}

function matchesEditableTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && Boolean(target.closest('input, textarea, select, [contenteditable="true"]'))
}

function matchesSelectionBlockedTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    Boolean(target.closest('button, input, textarea, select, a, canvas, video, [role="button"], [contenteditable="true"]'))
  )
}

function FieldLabel({
  children,
}: {
  children: string
}) {
  return <div className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">{children}</div>
}

function PanelInput({
  value,
  onChange,
  list,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  list?: string
  placeholder?: string
}) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      list={list}
      placeholder={placeholder}
      className="w-full rounded-[14px] border border-[var(--border)] bg-[var(--surface)]/84 px-3 py-2 text-[0.8rem] text-[var(--text)] outline-none transition-colors focus:border-[var(--primary)]"
    />
  )
}

function PanelSelect<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (value: T) => void
  options: Array<{ id: T; label: string }>
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value as T)}
      className="w-full rounded-[14px] border border-[var(--border)] bg-[var(--surface)]/84 px-3 py-2 text-[0.8rem] text-[var(--text)] outline-none transition-colors focus:border-[var(--primary)]"
    >
      {options.map((option) => (
        <option key={option.id} value={option.id}>
          {option.label}
        </option>
      ))}
    </select>
  )
}

function WidgetConfigPanel({
  widget,
  topic,
  topics,
  snapshot,
  onUpdateWidget,
  onResizeWidget,
}: {
  widget: HomeWorkspaceWidget
  topic: TelemetryTopic | null
  topics: TelemetryTopic[]
  snapshot: TelemetrySnapshot
  onUpdateWidget: HomeWorkspaceCanvasProps['onUpdateWidget']
  onResizeWidget: HomeWorkspaceCanvasProps['onResizeWidget']
}) {
  const { preferences } = useDashboardPreferences()
  const [topicSearchQuery, setTopicSearchQuery] = useState('')
  const [topicScopeFilter, setTopicScopeFilter] = useState<TelemetryTopicScopeFilter>('all')
  const title = widget.title
  const widgetMinimums = getHomeWorkspaceWidgetMinSize(widget)
  const widgetMaximums = getHomeWorkspaceWidgetMaxSize(widget)
  const preset = isHomeWorkspacePresetWidget(widget) ? getHomeWorkspacePresetDefinition(widget.presetId) : null
  const resolvedCameraFeeds = useMemo(
    () => resolveActiveCameraFeeds(preferences.cameraFeeds, snapshot.bridgeStatus?.discoveredCameraFeeds ?? []),
    [preferences.cameraFeeds, snapshot.bridgeStatus?.discoveredCameraFeeds],
  )
  const cameraFeedOptions = useMemo(
    () => {
      const options = [
        { id: '__auto__', label: 'Auto / first live feed' },
        ...resolvedCameraFeeds.map((feed) => ({
          id: feed.id,
          label: `${feed.label} (${feed.source === 'auto' ? 'auto' : 'manual'})`,
        })),
      ]

      if (
        isHomeWorkspacePresetWidget(widget) &&
        widget.presetId === 'camera-stream' &&
        widget.config.cameraFeedId &&
        !resolvedCameraFeeds.some((feed) => feed.id === widget.config.cameraFeedId)
      ) {
        options.push({
          id: widget.config.cameraFeedId,
          label: `Missing feed (${widget.config.cameraFeedId})`,
        })
      }

      return options
    },
    [resolvedCameraFeeds, widget],
  )
  const rendererOptionIds = isHomeWorkspaceTopicWidget(widget)
    ? (() => {
        const baseOptions = widget.topicKey === null ? UNBOUND_RENDERER_OPTIONS : allowedWidgetRenderers(topic)
        return baseOptions.includes(widget.renderer) ? baseOptions : [widget.renderer, ...baseOptions]
      })()
    : []
  const rendererOptions = isHomeWorkspaceTopicWidget(widget)
    ? rendererOptionIds.map((renderer) => ({
        id: renderer,
        label: widgetRendererLabel(renderer),
      }))
    : []
  const topicKey = isHomeWorkspaceTopicWidget(widget) ? widget.topicKey ?? '' : ''
  const numericTopic = isHomeWorkspaceTopicWidget(widget) && topic?.valueKind === 'number'

  const handleTopicChange = (value: string) => {
    if (!isHomeWorkspaceTopicWidget(widget)) {
      return
    }

    const nextKey = value.trim() || null
    const nextTopic = nextKey ? topics.find((candidate) => candidate.key === nextKey) ?? null : null
    const nextTitle =
      !title.trim() || /^new widget$/i.test(title.trim()) ? suggestedWidgetTitle(nextTopic) : title
    const nextRenderer =
      nextTopic && widget.renderer !== 'auto' && !allowedWidgetRenderers(nextTopic).includes(widget.renderer)
        ? 'auto'
        : undefined

    onUpdateWidget(widget.id, {
      topicKey: nextKey,
      title: nextTitle,
      renderer: nextRenderer,
    })
  }

  const commitDimension = (field: 'w' | 'h', rawValue: string) => {
    const parsed = Number(rawValue)
    if (!Number.isFinite(parsed)) {
      return
    }

    if (field === 'w') {
      onResizeWidget(widget.id, clampSize(parsed, widgetMinimums.w, widgetMaximums.w), widget.h)
      return
    }

    onResizeWidget(widget.id, widget.w, clampSize(parsed, widgetMinimums.h, widgetMaximums.h))
  }

  const commitNumericConfig = (field: keyof HomeWorkspaceWidgetConfig, rawValue: string) => {
    if (!isHomeWorkspaceTopicWidget(widget)) {
      return
    }

    if (rawValue.trim() === '') {
      onUpdateWidget(widget.id, { config: { [field]: null } })
      return
    }

    const parsed = Number(rawValue)
    if (!Number.isFinite(parsed)) {
      return
    }

    onUpdateWidget(widget.id, { config: { [field]: parsed } })
  }

  return (
    <div className="grid gap-3 rounded-[18px] border border-[var(--border)] bg-[var(--surface)]/82 px-3 py-3">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="grid gap-2">
          <FieldLabel>Title</FieldLabel>
          <PanelInput value={title} onChange={(value) => onUpdateWidget(widget.id, { title: value })} />
        </label>

        {isHomeWorkspaceTopicWidget(widget) ? (
          <label className="grid gap-2">
            <FieldLabel>Renderer</FieldLabel>
            <PanelSelect
              value={widget.renderer}
              onChange={(value) => onUpdateWidget(widget.id, { renderer: value })}
              options={rendererOptions}
            />
          </label>
        ) : (
          <div className="grid gap-2">
            <FieldLabel>Preset</FieldLabel>
            <div className="rounded-[14px] border border-[var(--border)] bg-[var(--surface-alt)]/82 px-3 py-2 text-[0.82rem] text-[var(--text)]">
              {preset?.label ?? 'Preset widget'}
            </div>
          </div>
        )}
      </div>

      {isHomeWorkspaceTopicWidget(widget) ? (
        <>
          <label className="grid gap-2">
            <FieldLabel>Topic / Data Source</FieldLabel>
            <PanelInput
              value={topicKey}
              onChange={handleTopicChange}
              placeholder="/robot/topic/path"
            />
          </label>

          <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface-alt)]/74 px-3 py-3">
            <TelemetryTopicBrowser
              topics={topics}
              searchQuery={topicSearchQuery}
              onSearchQueryChange={setTopicSearchQuery}
              scopeFilter={topicScopeFilter}
              onScopeFilterChange={setTopicScopeFilter}
              maxResults={18}
              listClassName="max-h-[320px]"
              emptyMessage="No live topics matched this filter."
              getAction={(candidate) => ({
                label: candidate.key === topicKey ? 'Selected' : 'Use topic',
                disabled: candidate.key === topicKey,
                onClick: () => handleTopicChange(candidate.key),
              })}
            />
          </div>
        </>
      ) : (
        <div className="grid gap-3">
          <div className="rounded-[16px] border border-[var(--border)] bg-[var(--surface-alt)]/82 px-3 py-3 text-[0.78rem] leading-6 text-[var(--text-muted)]">
            {preset?.description ?? 'Preset widgets reuse the live dashboard panel inside the overview whiteboard.'}
          </div>

          {widget.presetId === 'camera-stream' ? (
            <label className="grid gap-2">
              <FieldLabel>Camera Feed</FieldLabel>
              <PanelSelect
                value={widget.config.cameraFeedId ?? '__auto__'}
                onChange={(value) =>
                  onUpdateWidget(widget.id, {
                    presetConfig: { cameraFeedId: value === '__auto__' ? null : value },
                  })
                }
                options={cameraFeedOptions}
              />
            </label>
          ) : null}

          {widget.presetId === 'camera-stream' && resolvedCameraFeeds.length === 0 ? (
            <div className="rounded-[16px] border border-dashed border-[var(--border)] bg-[var(--surface)]/76 px-3 py-3 text-[0.76rem] leading-6 text-[var(--text-muted)]">
              No live camera feed is available right now. In simulation, enable the camera button. On hardware, keep a manual feed in Settings or wait for discovery.
            </div>
          ) : null}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-4">
        <label className="grid gap-2">
          <FieldLabel>Width</FieldLabel>
          <input
            type="number"
            min={widgetMinimums.w}
            max={widgetMaximums.w}
            defaultValue={widget.w}
            onBlur={(event) => commitDimension('w', event.target.value)}
            className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)]/84 px-3 py-2 text-[0.8rem] text-[var(--text)] outline-none focus:border-[var(--primary)]"
          />
        </label>

        <label className="grid gap-2">
          <FieldLabel>Height</FieldLabel>
          <input
            type="number"
            min={widgetMinimums.h}
            max={widgetMaximums.h}
            defaultValue={widget.h}
            onBlur={(event) => commitDimension('h', event.target.value)}
            className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)]/84 px-3 py-2 text-[0.8rem] text-[var(--text)] outline-none focus:border-[var(--primary)]"
          />
        </label>

        {isHomeWorkspaceTopicWidget(widget) ? (
          <>
            <label className="grid gap-2">
              <FieldLabel>Decimals</FieldLabel>
              <input
                type="number"
                min={0}
                max={4}
                defaultValue={widget.config.decimals}
                onBlur={(event) =>
                  onUpdateWidget(widget.id, {
                    config: { decimals: clampSize(Number(event.target.value) || 0, 0, 4) },
                  })
                }
                className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)]/84 px-3 py-2 text-[0.8rem] text-[var(--text)] outline-none focus:border-[var(--primary)]"
              />
            </label>

            <label className="grid gap-2">
              <FieldLabel>Units</FieldLabel>
              <PanelInput
                value={widget.config.units}
                onChange={(value) => onUpdateWidget(widget.id, { config: { units: value.slice(0, 16) } })}
                placeholder="V, mm, %"
              />
            </label>
          </>
        ) : null}
      </div>

      {isHomeWorkspaceTopicWidget(widget) ? (
        <div className="flex flex-wrap items-center gap-2">
          <ToolbarButton
            active={widget.config.compact}
            onClick={() => onUpdateWidget(widget.id, { config: { compact: !widget.config.compact } })}
            title="Force a denser internal widget layout"
          >
            Compact Mode
          </ToolbarButton>
        </div>
      ) : null}

      {numericTopic ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="grid gap-2">
            <FieldLabel>Warning Min</FieldLabel>
            <input
              type="number"
              defaultValue={widget.config.warningMin ?? ''}
              onBlur={(event) => commitNumericConfig('warningMin', event.target.value)}
              className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)]/84 px-3 py-2 text-[0.8rem] text-[var(--text)] outline-none focus:border-[var(--primary)]"
            />
          </label>
          <label className="grid gap-2">
            <FieldLabel>Warning Max</FieldLabel>
            <input
              type="number"
              defaultValue={widget.config.warningMax ?? ''}
              onBlur={(event) => commitNumericConfig('warningMax', event.target.value)}
              className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)]/84 px-3 py-2 text-[0.8rem] text-[var(--text)] outline-none focus:border-[var(--primary)]"
            />
          </label>
          <label className="grid gap-2">
            <FieldLabel>Critical Min</FieldLabel>
            <input
              type="number"
              defaultValue={widget.config.criticalMin ?? ''}
              onBlur={(event) => commitNumericConfig('criticalMin', event.target.value)}
              className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)]/84 px-3 py-2 text-[0.8rem] text-[var(--text)] outline-none focus:border-[var(--primary)]"
            />
          </label>
          <label className="grid gap-2">
            <FieldLabel>Critical Max</FieldLabel>
            <input
              type="number"
              defaultValue={widget.config.criticalMax ?? ''}
              onBlur={(event) => commitNumericConfig('criticalMax', event.target.value)}
              className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)]/84 px-3 py-2 text-[0.8rem] text-[var(--text)] outline-none focus:border-[var(--primary)]"
            />
          </label>
        </div>
      ) : null}
    </div>
  )
}

function WidgetActionPanel({
  widget,
  onRemove,
}: {
  widget: HomeWorkspaceWidget
  onRemove: () => void
}) {
  return (
    <div className="grid gap-3 rounded-[18px] border border-[var(--border)] bg-[var(--surface)]/82 px-3 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <FieldLabel>Widget Actions</FieldLabel>
        <div className="text-[0.72rem] leading-6 text-[var(--text-muted)]">
          Drag the header to move. Resize from the bottom-right corner.
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onRemove}
          className="rounded-full border border-[color-mix(in_srgb,var(--danger)_24%,var(--border)_76%)] bg-[color-mix(in_srgb,var(--danger)_12%,var(--surface)_88%)] px-3 py-2 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[var(--text)] transition-colors hover:bg-[color-mix(in_srgb,var(--danger)_18%,var(--surface)_82%)]"
        >
          Remove widget
        </button>
        <div className="text-[0.72rem] leading-6 text-[var(--text-muted)]">
          Position {widget.x + 1},{widget.y + 1} on the board.
        </div>
      </div>
    </div>
  )
}

const WIDGET_CONFIG_MODAL_THEME: CSSProperties = {
  '--background': '#f8fafc',
  '--surface': '#ffffff',
  '--surface-alt': '#f1f5f9',
  '--border': 'rgba(148, 163, 184, 0.38)',
  '--border-strong': 'rgba(100, 116, 139, 0.44)',
  '--text': '#0f172a',
  '--text-muted': '#475569',
  '--primary-soft': 'rgba(59, 130, 246, 0.12)',
  '--card-shadow-strong': '0 28px 90px rgba(15, 23, 42, 0.28)',
} as CSSProperties

function WidgetConfigModal({
  editMode,
  onClose,
  onRemoveWidget,
  onResizeWidget,
  onUpdateWidget,
  snapshot,
  topic,
  topics,
  widget,
}: {
  editMode: boolean
  onClose: () => void
  onRemoveWidget: HomeWorkspaceCanvasProps['onRemoveWidget']
  onResizeWidget: HomeWorkspaceCanvasProps['onResizeWidget']
  onUpdateWidget: HomeWorkspaceCanvasProps['onUpdateWidget']
  snapshot: TelemetrySnapshot
  topic: TelemetryTopic | null
  topics: TelemetryTopic[]
  widget: HomeWorkspaceWidget
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return
      }

      event.preventDefault()
      onClose()
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  if (typeof document === 'undefined') {
    return null
  }

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center px-4 py-6" onClick={onClose}>
      <div className="absolute inset-0 bg-[rgba(15,23,42,0.36)] backdrop-blur-[6px]" />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`widget-config-title-${widget.id}`}
        onClick={(event) => event.stopPropagation()}
        className="relative z-[1] flex w-full max-w-[820px] max-h-[min(84vh,860px)] flex-col overflow-hidden rounded-[28px] border shadow-[var(--card-shadow-strong)]"
        style={WIDGET_CONFIG_MODAL_THEME}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
          <div className="min-w-0">
            <div className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
              {isHomeWorkspacePresetWidget(widget) ? 'Preset widget' : 'Topic widget'}
            </div>
            <h3
              id={`widget-config-title-${widget.id}`}
              className="mt-1 truncate text-[1.08rem] font-semibold tracking-[-0.04em] text-[var(--text)]"
            >
              {widget.title}
            </h3>
            <div className="mt-2 text-[0.82rem] leading-6 text-[var(--text-muted)]">
              Adjust binding, renderer, sizing and thresholds from one light modal instead of expanding the card.
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close widget configuration"
            className="inline-flex h-10 w-10 flex-none items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-alt)] text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
          >
            <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M6 6l8 8M14 6l-8 8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="min-h-0 overflow-y-auto px-5 py-5">
          <div className="grid gap-4">
            <WidgetConfigPanel
              key={widget.id}
              widget={widget}
              topic={topic}
              topics={topics}
              snapshot={snapshot}
              onUpdateWidget={onUpdateWidget}
              onResizeWidget={onResizeWidget}
            />
            {editMode ? (
              <WidgetActionPanel
                widget={widget}
                onRemove={() => {
                  onRemoveWidget(widget.id)
                  onClose()
                }}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export function HomeWorkspaceCanvas({
  alerts,
  batteryHistory,
  derived,
  widgets,
  topics,
  historyByTopic,
  editMode,
  snapshot,
  onUpdateWidget,
  onRemoveWidget,
  onMoveWidget,
  onResizeWidget,
}: HomeWorkspaceCanvasProps) {
  const topicMap = useMemo(() => new Map(topics.map((topic) => [topic.key, topic])), [topics])
  const gridRef = useRef<HTMLDivElement | null>(null)
  const interactionRef = useRef<InteractionState | null>(null)
  const [interaction, setInteraction] = useState<InteractionState | null>(null)
  const [configuredWidgetId, setConfiguredWidgetId] = useState<string | null>(null)
  const [selectedWidgetIdState, setSelectedWidgetId] = useState<string | null>(null)
  const [hoveredWidgetId, setHoveredWidgetId] = useState<string | null>(null)

  const syncInteraction = (next: InteractionState | null) => {
    interactionRef.current = next
    setInteraction(next)
  }

  const configuredWidget = configuredWidgetId
    ? widgets.find((candidate) => candidate.id === configuredWidgetId) ?? null
    : null
  const configuredTopic =
    configuredWidget && isHomeWorkspaceTopicWidget(configuredWidget) && configuredWidget.topicKey
      ? topicMap.get(configuredWidget.topicKey) ?? null
      : null
  const selectedWidgetId =
    editMode && selectedWidgetIdState && widgets.some((widget) => widget.id === selectedWidgetIdState)
      ? selectedWidgetIdState
      : null

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!editMode || configuredWidgetId) {
        return
      }

      if (matchesEditableTarget(event.target)) {
        return
      }

      if (event.key === 'Escape') {
        if (selectedWidgetId !== null) {
          event.preventDefault()
          setSelectedWidgetId(null)
        }
        return
      }

      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedWidgetId) {
        event.preventDefault()
        onRemoveWidget(selectedWidgetId)
        setSelectedWidgetId(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [configuredWidgetId, editMode, onRemoveWidget, selectedWidgetId])

  const beginInteraction = (
    event: ReactPointerEvent<HTMLButtonElement | HTMLDivElement>,
    widget: HomeWorkspaceWidget,
    kind: 'move' | 'resize',
  ) => {
    if (!editMode || !gridRef.current) {
      return
    }

    event.preventDefault()
    event.stopPropagation()

    const rect = gridRef.current.getBoundingClientRect()
    const cellWidth =
      (rect.width - HOME_WORKSPACE_GRID_GAP_PX * (HOME_WORKSPACE_GRID_COLUMNS - 1)) / HOME_WORKSPACE_GRID_COLUMNS
    const minimums = getHomeWorkspaceWidgetMinSize(widget)
    const maximums = getHomeWorkspaceWidgetMaxSize(widget)
    setSelectedWidgetId(widget.id)

    syncInteraction({
      kind,
      widgetId: widget.id,
      minH: minimums.h,
      minW: minimums.w,
      maxH: maximums.h,
      maxW: maximums.w,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startRect: {
        x: widget.x,
        y: widget.y,
        w: widget.w,
        h: widget.h,
      },
      previewRect: {
        x: widget.x,
        y: widget.y,
        w: widget.w,
        h: widget.h,
      },
      cellWidth,
    })
  }

  const handlePointerMove = useEffectEvent((event: PointerEvent) => {
    setInteraction((current) => {
      if (!current) {
        return current
      }

      const deltaColumns = Math.round((event.clientX - current.startClientX) / (current.cellWidth + HOME_WORKSPACE_GRID_GAP_PX))
      const deltaRows = Math.round((event.clientY - current.startClientY) / (HOME_WORKSPACE_GRID_ROW_PX + HOME_WORKSPACE_GRID_GAP_PX))

      if (current.kind === 'move') {
        const nextRect = {
          ...current.previewRect,
          x: Math.max(0, Math.min(HOME_WORKSPACE_GRID_COLUMNS - current.startRect.w, current.startRect.x + deltaColumns)),
          y: Math.max(0, current.startRect.y + deltaRows),
        }

        if (
          nextRect.x === current.previewRect.x &&
          nextRect.y === current.previewRect.y
        ) {
          return current
        }

        const next = {
          ...current,
          previewRect: nextRect,
        }
        interactionRef.current = next
        return next
      }

      const nextRect = {
        ...current.previewRect,
        w: clampSize(current.startRect.w + deltaColumns, current.minW, current.maxW),
        h: clampSize(current.startRect.h + deltaRows, current.minH, current.maxH),
      }

      nextRect.w = Math.min(nextRect.w, HOME_WORKSPACE_GRID_COLUMNS - current.startRect.x)

      if (
        nextRect.w === current.previewRect.w &&
        nextRect.h === current.previewRect.h
      ) {
        return current
      }

      const next = {
        ...current,
        previewRect: nextRect,
      }
      interactionRef.current = next
      return next
    })
  })

  const handlePointerUp = useEffectEvent(() => {
    const current = interactionRef.current
    if (!current) {
      return
    }

    if (current.kind === 'move') {
      onMoveWidget(current.widgetId, current.previewRect.x, current.previewRect.y)
    } else {
      onResizeWidget(current.widgetId, current.previewRect.w, current.previewRect.h)
    }

    syncInteraction(null)
  })

  useEffect(() => {
    if (!interaction) {
      return
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp, { once: true })

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [interaction])

  return (
    <>
      <div className="h-full min-h-0 overflow-auto pr-1">
        <div
          ref={gridRef}
          className="grid min-h-[420px] min-w-0 auto-rows-[44px] gap-3"
          style={{ gridTemplateColumns: `repeat(${HOME_WORKSPACE_GRID_COLUMNS}, minmax(0, 1fr))` }}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedWidgetId(null)
            }
          }}
        >
          {widgets.map((widget) => {
            const previewRect =
              interaction?.widgetId === widget.id
                ? interaction.previewRect
                : {
                    x: widget.x,
                    y: widget.y,
                    w: widget.w,
                    h: widget.h,
                  }
            const topic = isHomeWorkspaceTopicWidget(widget) && widget.topicKey ? topicMap.get(widget.topicKey) ?? null : null
            const history = isHomeWorkspaceTopicWidget(widget) && widget.topicKey ? historyByTopic[widget.topicKey] ?? [] : []
            const selected = selectedWidgetId === widget.id
            const hovered = hoveredWidgetId === widget.id
            const showQuickRemove = editMode && (selected || hovered)

            return (
              <div
                key={widget.id}
                className={cn('min-h-0', interaction?.widgetId === widget.id ? 'z-[3]' : selected ? 'z-[2]' : 'z-[1]')}
                style={{
                  gridColumn: `${previewRect.x + 1} / span ${previewRect.w}`,
                  gridRow: `${previewRect.y + 1} / span ${previewRect.h}`,
                }}
              >
                <article
                  aria-selected={editMode ? selected : undefined}
                  onMouseEnter={() => setHoveredWidgetId(widget.id)}
                  onMouseLeave={() => setHoveredWidgetId((current) => (current === widget.id ? null : current))}
                  onClick={(event) => {
                    if (!editMode || matchesSelectionBlockedTarget(event.target)) {
                      return
                    }

                    setSelectedWidgetId(widget.id)
                  }}
                  className={cn(
                    'relative flex h-full min-h-0 flex-col overflow-hidden rounded-[22px] border bg-[color-mix(in_srgb,var(--surface)_82%,var(--background)_18%)]',
                    interaction?.widgetId === widget.id
                      ? 'border-[var(--primary)] shadow-[0_0_0_1px_color-mix(in_srgb,var(--primary)_32%,transparent)]'
                      : selected
                        ? 'border-[color-mix(in_srgb,var(--primary)_48%,var(--border)_52%)] shadow-[0_0_0_1px_color-mix(in_srgb,var(--primary)_22%,transparent)]'
                        : 'border-[var(--border)]',
                  )}
                >
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 top-0 h-16 opacity-70"
                    style={{
                      background:
                        'linear-gradient(180deg, color-mix(in srgb, var(--primary) 24%, transparent) 0%, transparent 100%)',
                    }}
                  />

                  <header className="relative z-[1] flex items-center justify-between gap-3 border-b border-[var(--border)]/72 px-3 py-3">
                    <div
                      className={cn(
                        'flex min-w-0 flex-1 items-center gap-2',
                        editMode && 'cursor-grab touch-none active:cursor-grabbing',
                      )}
                      onPointerDown={editMode ? (event) => beginInteraction(event, widget, 'move') : undefined}
                      title={editMode ? 'Drag to move widget' : undefined}
                    >
                      {editMode ? (
                        <svg
                          viewBox="0 0 20 20"
                          aria-hidden="true"
                          className="h-4 w-4 flex-none text-[var(--text-muted)]"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                        >
                          <path d="M7 5.5h.01M13 5.5h.01M7 10h.01M13 10h.01M7 14.5h.01M13 14.5h.01" strokeLinecap="round" />
                        </svg>
                      ) : null}
                      <div className="min-w-0">
                        <div className="truncate text-[0.88rem] font-semibold tracking-[-0.03em] text-[var(--text)]">
                          {widget.title}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {showQuickRemove ? (
                        <QuickRemoveButton
                          onClick={() => {
                            onRemoveWidget(widget.id)
                            setSelectedWidgetId((current) => (current === widget.id ? null : current))
                            setHoveredWidgetId((current) => (current === widget.id ? null : current))
                          }}
                        />
                      ) : null}
                      <ConfigureButton
                        onClick={() => {
                          setSelectedWidgetId(widget.id)
                          setConfiguredWidgetId(widget.id)
                        }}
                      />
                    </div>
                  </header>

                  <div className="relative z-[1] flex min-h-0 flex-1 overflow-hidden px-3 py-3">
                    <div className="min-h-0 flex-1">
                      <HomeWorkspaceWidgetRenderer
                        widget={widget}
                        topic={topic}
                        topicMap={topicMap}
                        history={history}
                        snapshot={snapshot}
                        derived={derived}
                        alerts={alerts}
                        batteryHistory={batteryHistory}
                      />
                    </div>
                  </div>

                  {editMode ? (
                    <div
                      role="presentation"
                      onPointerDown={(event) => beginInteraction(event, widget, 'resize')}
                      className="absolute bottom-2 right-2 z-[2] h-5 w-5 cursor-se-resize rounded-[6px] border border-[var(--border)] bg-[var(--surface)]/90 text-[var(--text-muted)]"
                      title="Resize widget"
                    >
                      <svg viewBox="0 0 20 20" aria-hidden="true" className="h-full w-full fill-none stroke-current p-1.5" strokeWidth="1.5">
                        <path d="M6 14L14 6M10 14L14 10M14 14h0" />
                      </svg>
                    </div>
                  ) : null}
                </article>
              </div>
            )
          })}
        </div>
      </div>

      {configuredWidget ? (
        <WidgetConfigModal
          widget={configuredWidget}
          topic={configuredTopic}
          topics={topics}
          snapshot={snapshot}
          editMode={editMode}
          onClose={() => setConfiguredWidgetId(null)}
          onUpdateWidget={onUpdateWidget}
          onResizeWidget={onResizeWidget}
          onRemoveWidget={onRemoveWidget}
        />
      ) : null}
    </>
  )
}
