import {
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { cn } from '../../../lib/cn'
import {
  HOME_WORKSPACE_GRID_COLUMNS,
  HOME_WORKSPACE_GRID_GAP_PX,
  HOME_WORKSPACE_GRID_ROW_PX,
  HOME_WORKSPACE_MAX_WIDGET_H,
  HOME_WORKSPACE_MAX_WIDGET_W,
  HOME_WORKSPACE_MIN_WIDGET_H,
  HOME_WORKSPACE_MIN_WIDGET_W,
  type HomeWorkspaceWidget,
} from '../../../home-workspace/homeWorkspaceStore'
import type { TelemetryTopic } from '../../../types/telemetry'
import {
  HomeWorkspaceWidgetRenderer,
  allowedWidgetRenderers,
  resolveWidgetDensity,
  suggestedWidgetTitle,
  widgetRendererLabel,
  type WorkspaceHistoryPoint,
} from './HomeWorkspaceWidgetRenderer'

interface HomeWorkspaceCanvasProps {
  widgets: HomeWorkspaceWidget[]
  topics: TelemetryTopic[]
  historyByTopic: Record<string, WorkspaceHistoryPoint[]>
  editMode: boolean
  onUpdateWidget: (
    widgetId: string,
    patch: {
      title?: string
      topicKey?: string | null
      renderer?: HomeWorkspaceWidget['renderer']
      config?: Partial<HomeWorkspaceWidget['config']>
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
  startRect: Pick<HomeWorkspaceWidget, 'x' | 'y' | 'w' | 'h'>
  previewRect: Pick<HomeWorkspaceWidget, 'x' | 'y' | 'w' | 'h'>
  cellWidth: number
}

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
  onUpdateWidget,
  onResizeWidget,
}: {
  widget: HomeWorkspaceWidget
  topic: TelemetryTopic | null
  topics: TelemetryTopic[]
  onUpdateWidget: HomeWorkspaceCanvasProps['onUpdateWidget']
  onResizeWidget: HomeWorkspaceCanvasProps['onResizeWidget']
}) {
  const rendererOptions = allowedWidgetRenderers(topic).map((renderer) => ({
    id: renderer,
    label: widgetRendererLabel(renderer),
  }))
  const listId = `workspace-topic-list-${widget.id}`
  const topicKey = widget.topicKey ?? ''
  const numericTopic = topic?.valueKind === 'number'
  const title = widget.title

  const handleTopicChange = (value: string) => {
    const nextKey = value.trim() || null
    const nextTopic = nextKey ? topics.find((candidate) => candidate.key === nextKey) ?? null : null
    const nextTitle =
      !title.trim() || /^new widget$/i.test(title.trim()) ? suggestedWidgetTitle(nextTopic) : title

    onUpdateWidget(widget.id, {
      topicKey: nextKey,
      title: nextTitle,
    })
  }

  const commitDimension = (field: 'w' | 'h', rawValue: string) => {
    const parsed = Number(rawValue)
    if (!Number.isFinite(parsed)) {
      return
    }

    if (field === 'w') {
      onResizeWidget(widget.id, clampSize(parsed, HOME_WORKSPACE_MIN_WIDGET_W, HOME_WORKSPACE_MAX_WIDGET_W), widget.h)
      return
    }

    onResizeWidget(widget.id, widget.w, clampSize(parsed, HOME_WORKSPACE_MIN_WIDGET_H, HOME_WORKSPACE_MAX_WIDGET_H))
  }

  const commitNumericConfig = (field: keyof HomeWorkspaceWidget['config'], rawValue: string) => {
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

        <label className="grid gap-2">
          <FieldLabel>Renderer</FieldLabel>
          <PanelSelect
            value={widget.renderer}
            onChange={(value) => onUpdateWidget(widget.id, { renderer: value })}
            options={rendererOptions}
          />
        </label>
      </div>

      <label className="grid gap-2">
        <FieldLabel>Topic / Data Source</FieldLabel>
        <PanelInput
          value={topicKey}
          onChange={handleTopicChange}
          list={listId}
          placeholder="/robot/topic/path"
        />
        <datalist id={listId}>
          {topics.map((entry) => (
            <option key={entry.key} value={entry.key}>
              {entry.label}
            </option>
          ))}
        </datalist>
      </label>

      <div className="grid gap-3 md:grid-cols-4">
        <label className="grid gap-2">
          <FieldLabel>Width</FieldLabel>
          <input
            type="number"
            min={HOME_WORKSPACE_MIN_WIDGET_W}
            max={HOME_WORKSPACE_MAX_WIDGET_W}
            defaultValue={widget.w}
            onBlur={(event) => commitDimension('w', event.target.value)}
            className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)]/84 px-3 py-2 text-[0.8rem] text-[var(--text)] outline-none focus:border-[var(--primary)]"
          />
        </label>

        <label className="grid gap-2">
          <FieldLabel>Height</FieldLabel>
          <input
            type="number"
            min={HOME_WORKSPACE_MIN_WIDGET_H}
            max={HOME_WORKSPACE_MAX_WIDGET_H}
            defaultValue={widget.h}
            onBlur={(event) => commitDimension('h', event.target.value)}
            className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)]/84 px-3 py-2 text-[0.8rem] text-[var(--text)] outline-none focus:border-[var(--primary)]"
          />
        </label>

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
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <ToolbarButton
          active={widget.config.compact}
          onClick={() => onUpdateWidget(widget.id, { config: { compact: !widget.config.compact } })}
          title="Force a denser internal widget layout"
        >
          Compact Mode
        </ToolbarButton>
      </div>

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

export function HomeWorkspaceCanvas({
  widgets,
  topics,
  historyByTopic,
  editMode,
  onUpdateWidget,
  onRemoveWidget,
  onMoveWidget,
  onResizeWidget,
}: HomeWorkspaceCanvasProps) {
  const topicMap = useMemo(() => new Map(topics.map((topic) => [topic.key, topic])), [topics])
  const gridRef = useRef<HTMLDivElement | null>(null)
  const interactionRef = useRef<InteractionState | null>(null)
  const [interaction, setInteraction] = useState<InteractionState | null>(null)
  const [expandedWidgetId, setExpandedWidgetId] = useState<string | null>(null)

  const syncInteraction = (next: InteractionState | null) => {
    interactionRef.current = next
    setInteraction(next)
  }

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

    syncInteraction({
      kind,
      widgetId: widget.id,
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
        w: clampSize(current.startRect.w + deltaColumns, HOME_WORKSPACE_MIN_WIDGET_W, HOME_WORKSPACE_MAX_WIDGET_W),
        h: clampSize(current.startRect.h + deltaRows, HOME_WORKSPACE_MIN_WIDGET_H, HOME_WORKSPACE_MAX_WIDGET_H),
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
  }, [handlePointerMove, handlePointerUp, interaction])

  return (
    <div
      ref={gridRef}
      className="grid h-full min-h-[420px] auto-rows-[44px] gap-3"
      style={{ gridTemplateColumns: `repeat(${HOME_WORKSPACE_GRID_COLUMNS}, minmax(0, 1fr))` }}
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
        const topic = widget.topicKey ? topicMap.get(widget.topicKey) ?? null : null
        const history = widget.topicKey ? historyByTopic[widget.topicKey] ?? [] : []
        const density = resolveWidgetDensity(widget)
        const settingsOpen = expandedWidgetId === widget.id

        return (
          <div
            key={widget.id}
            className={cn('min-h-0', interaction?.widgetId === widget.id ? 'z-[3]' : 'z-[1]')}
            style={{
              gridColumn: `${previewRect.x + 1} / span ${previewRect.w}`,
              gridRow: `${previewRect.y + 1} / span ${previewRect.h}`,
            }}
          >
            <article
              className={cn(
                'relative flex h-full min-h-0 flex-col overflow-hidden rounded-[22px] border bg-[color-mix(in_srgb,var(--surface)_82%,var(--background)_18%)]',
                interaction?.widgetId === widget.id
                  ? 'border-[var(--primary)] shadow-[0_0_0_1px_color-mix(in_srgb,var(--primary)_32%,transparent)]'
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

              <header className="relative z-[1] flex items-start justify-between gap-3 border-b border-[var(--border)]/72 px-3 py-3">
                <div className="min-w-0">
                  <div className="truncate text-[0.88rem] font-semibold tracking-[-0.03em] text-[var(--text)]">
                    {widget.title}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                    <span>{topic?.scope ?? 'unbound'}</span>
                    <span>{widgetRendererLabel(widget.renderer)}</span>
                    <span>{density}</span>
                    <span>
                      {widget.w}x{widget.h}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-1.5">
                  <ToolbarButton
                    onClick={() => setExpandedWidgetId(settingsOpen ? null : widget.id)}
                    active={settingsOpen}
                  >
                    Configure
                  </ToolbarButton>
                  {editMode ? (
                    <ToolbarButton
                      onClick={() => onRemoveWidget(widget.id)}
                    >
                      Remove
                    </ToolbarButton>
                  ) : null}
                  {editMode ? (
                    <button
                      type="button"
                      onPointerDown={(event) => beginInteraction(event, widget, 'move')}
                      className="cursor-grab rounded-full border border-[var(--border)] bg-[var(--surface)]/82 px-2.5 py-1.5 text-[0.64rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)] hover:bg-[var(--surface-alt)] hover:text-[var(--text)] active:cursor-grabbing"
                    >
                      Move
                    </button>
                  ) : null}
                </div>
              </header>

              <div className="relative z-[1] flex min-h-0 flex-1 flex-col gap-3 overflow-auto px-3 py-3">
                <div className="min-h-0 flex-1">
                  <HomeWorkspaceWidgetRenderer widget={widget} topic={topic} history={history} />
                </div>

                {settingsOpen ? (
                  <WidgetConfigPanel
                    widget={widget}
                    topic={topic}
                    topics={topics}
                    onUpdateWidget={onUpdateWidget}
                    onResizeWidget={onResizeWidget}
                  />
                ) : null}
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
  )
}
