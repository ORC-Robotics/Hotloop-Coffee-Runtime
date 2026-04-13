/* eslint-disable react-refresh/only-export-components */

import { cn } from '../../../lib/cn'
import { clamp } from '../../../lib/format'
import { getHomeWorkspacePresetDefinition } from '../../../home-workspace/homeWorkspacePresets'
import {
  isHomeWorkspacePresetWidget,
  isHomeWorkspaceTopicWidget,
  type HomeWorkspaceTopicWidget,
  type HomeWorkspaceWidget,
  type HomeWorkspaceWidgetRenderer as WidgetRendererId,
} from '../../../home-workspace/homeWorkspaceStore'
import type {
  AlertItem,
  BatteryHistoryPoint,
  TelemetryDerivedState,
  TelemetrySnapshot,
  TelemetryTopic,
} from '../../../types/telemetry'
import { AlertsPanelBody } from '../AlertsPanel'
import { BatteryPanelBody } from '../BatteryPanel'
import { CommandsPanelBody } from '../CommandsPanel'
import { HeadingPanelBody } from '../HeadingPanel'
import { SystemsHealthPanelBody } from '../SystemsHealthPanel'

export type WorkspaceHistoryPoint = {
  timestamp: string
  value: number
}

export type WorkspaceWidgetDensity = 'compact' | 'medium' | 'large'
type WorkspaceTopicKind = 'number' | 'boolean' | 'text'
type WorkspaceWidgetTone = 'good' | 'warning' | 'critical' | 'neutral'

function getTopicKind(topic: TelemetryTopic | null): WorkspaceTopicKind {
  if (topic?.valueKind === 'number') return 'number'
  if (topic?.valueKind === 'boolean') return 'boolean'
  return 'text'
}

function getNumericTopicValue(topic: TelemetryTopic | null) {
  if (!topic || topic.valueKind !== 'number' || typeof topic.value !== 'number' || !Number.isFinite(topic.value)) {
    return null
  }

  return topic.value
}

function formatNumberValue(value: number | null, decimals: number, units: string) {
  if (value === null) {
    return '--'
  }

  const unitSuffix = units.trim() ? ` ${units.trim()}` : ''
  return `${value.toFixed(decimals)}${unitSuffix}`
}

function toneAccent(tone: WorkspaceWidgetTone) {
  if (tone === 'critical') {
    return {
      color: 'var(--danger)',
      soft: 'color-mix(in srgb, var(--danger) 18%, transparent)',
      border: 'color-mix(in srgb, var(--danger) 32%, transparent)',
    }
  }

  if (tone === 'warning') {
    return {
      color: 'var(--warning)',
      soft: 'color-mix(in srgb, var(--warning) 18%, transparent)',
      border: 'color-mix(in srgb, var(--warning) 32%, transparent)',
    }
  }

  if (tone === 'good') {
    return {
      color: 'var(--accent)',
      soft: 'color-mix(in srgb, var(--accent) 18%, transparent)',
      border: 'color-mix(in srgb, var(--accent) 32%, transparent)',
    }
  }

  return {
    color: 'var(--secondary, var(--info))',
    soft: 'color-mix(in srgb, var(--info) 18%, transparent)',
    border: 'color-mix(in srgb, var(--border-strong) 48%, transparent)',
  }
}

function evaluateNumericTone(value: number | null, widget: HomeWorkspaceTopicWidget): WorkspaceWidgetTone {
  if (value === null) {
    return 'neutral'
  }

  const { warningMin, warningMax, criticalMin, criticalMax } = widget.config

  if (
    (criticalMin !== null && value < criticalMin) ||
    (criticalMax !== null && value > criticalMax)
  ) {
    return 'critical'
  }

  if (
    (warningMin !== null && value < warningMin) ||
    (warningMax !== null && value > warningMax)
  ) {
    return 'warning'
  }

  return 'good'
}

function densityFromWidget(widget: HomeWorkspaceWidget): WorkspaceWidgetDensity {
  const area = widget.w * widget.h
  let density: WorkspaceWidgetDensity = 'medium'

  if (area <= 10 || widget.w <= 3 || widget.h <= 2) {
    density = 'compact'
  } else if (area >= 20 || widget.w >= 6 || widget.h >= 4) {
    density = 'large'
  }

  if (isHomeWorkspaceTopicWidget(widget) && widget.config.compact && density === 'large') return 'medium'
  if (isHomeWorkspaceTopicWidget(widget) && widget.config.compact && density === 'medium') return 'compact'
  return density
}

export function resolveWidgetDensity(widget: HomeWorkspaceWidget) {
  return densityFromWidget(widget)
}

function rendererFallbackForDensity(
  renderer: WidgetRendererId,
  topicKind: WorkspaceTopicKind,
  density: WorkspaceWidgetDensity,
): WidgetRendererId {
  if (density === 'compact') {
    if (renderer === 'sparkline' || renderer === 'gauge' || renderer === 'bar') {
      return topicKind === 'number' ? 'number' : 'text-line'
    }

    if (renderer === 'boolean-tile') return 'boolean-pill'
    if (renderer === 'text-tile') return 'text-line'
  }

  if (density === 'medium') {
    if (renderer === 'sparkline' && topicKind === 'number') return 'stat'
    if (renderer === 'text-tile' && topicKind === 'text') return 'text-line'
  }

  return renderer
}

export function allowedWidgetRenderers(topic: TelemetryTopic | null): WidgetRendererId[] {
  const kind = getTopicKind(topic)

  if (kind === 'boolean') {
    return ['auto', 'boolean-light', 'boolean-pill', 'boolean-tile', 'text-line']
  }

  if (kind === 'number') {
    return ['auto', 'number', 'stat', 'gauge', 'bar', 'sparkline']
  }

  return ['auto', 'text-line', 'text-tile']
}

export function widgetRendererLabel(renderer: WidgetRendererId) {
  if (renderer === 'number') return 'Plain Number'
  if (renderer === 'stat') return 'Stat Card'
  if (renderer === 'gauge') return 'Gauge'
  if (renderer === 'bar') return 'Percent Bar'
  if (renderer === 'sparkline') return 'Trend Graph'
  if (renderer === 'boolean-light') return 'Status Light'
  if (renderer === 'boolean-pill') return 'Pill State'
  if (renderer === 'boolean-tile') return 'On/Off Tile'
  if (renderer === 'text-line') return 'Status Line'
  if (renderer === 'text-tile') return 'Readout Tile'
  return 'Auto'
}

export function workspaceWidgetLabel(widget: HomeWorkspaceWidget) {
  if (isHomeWorkspacePresetWidget(widget)) {
    return getHomeWorkspacePresetDefinition(widget.presetId)?.label ?? 'Preset'
  }

  return widgetRendererLabel(widget.renderer)
}

function resolveRenderer(widget: HomeWorkspaceTopicWidget, topic: TelemetryTopic | null, density: WorkspaceWidgetDensity) {
  const kind = getTopicKind(topic)
  const allowed = allowedWidgetRenderers(topic)

  if (widget.renderer !== 'auto' && allowed.includes(widget.renderer)) {
    return rendererFallbackForDensity(widget.renderer, kind, density)
  }

  if (kind === 'boolean') {
    if (density === 'compact') return 'boolean-light'
    if (density === 'large') return 'boolean-tile'
    return 'boolean-pill'
  }

  if (kind === 'number') {
    if (density === 'compact') return 'number'
    if (density === 'large') return widget.h >= 4 ? 'sparkline' : 'gauge'
    return 'stat'
  }

  return density === 'large' ? 'text-tile' : 'text-line'
}

export function suggestedWidgetTitle(topic: TelemetryTopic | null) {
  return topic?.label?.trim() || 'New Widget'
}

function polarToCartesian(centerX: number, centerY: number, radius: number, angleDegrees: number) {
  const angleRadians = ((angleDegrees - 90) * Math.PI) / 180
  return {
    x: centerX + radius * Math.cos(angleRadians),
    y: centerY + radius * Math.sin(angleRadians),
  }
}

function describeArc(x: number, y: number, radius: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(x, y, radius, endAngle)
  const end = polarToCartesian(x, y, radius, startAngle)
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1'
  return ['M', start.x, start.y, 'A', radius, radius, 0, largeArcFlag, 0, end.x, end.y].join(' ')
}

function buildSparklinePath(history: WorkspaceHistoryPoint[], min: number, max: number, width: number, height: number) {
  if (history.length < 2) {
    return `M 0 ${height / 2} L ${width} ${height / 2}`
  }

  const safeRange = Math.max(0.0001, max - min)
  return history
    .map((point, index) => {
      const x = (index / Math.max(1, history.length - 1)) * width
      const y = height - ((point.value - min) / safeRange) * height
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${clamp(y, 0, height).toFixed(2)}`
    })
    .join(' ')
}

function WidgetEmptyState({
  title,
  subtitle,
}: {
  title: string
  subtitle: string
}) {
  return (
    <div className="flex h-full min-h-0 items-center justify-center rounded-[18px] border border-dashed border-[var(--border)] bg-[var(--surface)]/44 px-4 py-5 text-center">
      <div>
        <div className="text-[0.76rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
          {title}
        </div>
        <div className="mt-2 text-[0.84rem] leading-6 text-[var(--text-muted)]">{subtitle}</div>
      </div>
    </div>
  )
}

function NumberView({
  value,
  widget,
  density,
  topic,
}: {
  value: number | null
  widget: HomeWorkspaceTopicWidget
  density: WorkspaceWidgetDensity
  topic: TelemetryTopic | null
}) {
  const tone = evaluateNumericTone(value, widget)
  const accent = toneAccent(tone)

  return (
    <div className="flex h-full flex-col justify-between gap-3">
      <div className="text-[0.72rem] uppercase tracking-[0.14em]" style={{ color: accent.color }}>
        {widgetRendererLabel(resolveRenderer(widget, topic, density))}
      </div>
      <div
        className={cn(
          'font-mono leading-none tracking-[-0.05em] text-[var(--text)]',
          density === 'compact'
            ? 'text-[clamp(1.15rem,1rem+0.55vw,1.55rem)]'
            : density === 'large'
              ? 'text-[clamp(2rem,1.4rem+1.6vw,3.4rem)]'
              : 'text-[clamp(1.45rem,1.2rem+1vw,2.35rem)]',
        )}
      >
        {formatNumberValue(value, widget.config.decimals, widget.config.units)}
      </div>
      <div className="flex items-center justify-between gap-3 text-[0.74rem] leading-6 text-[var(--text-muted)]">
        <div>{topic?.valueText ?? 'No live value yet.'}</div>
        <div>{tone}</div>
      </div>
    </div>
  )
}

function StatView({
  value,
  widget,
  density,
  topic,
}: {
  value: number | null
  widget: HomeWorkspaceTopicWidget
  density: WorkspaceWidgetDensity
  topic: TelemetryTopic | null
}) {
  const tone = evaluateNumericTone(value, widget)
  const accent = toneAccent(tone)

  return (
    <div
      className="grid h-full min-h-0 gap-3 rounded-[18px] border bg-[var(--surface)]/74 px-4 py-4"
      style={{ borderColor: accent.border }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="text-[0.74rem] uppercase tracking-[0.14em]" style={{ color: accent.color }}>
          {tone}
        </div>
        {density !== 'compact' ? (
          <div className="text-right text-[0.7rem] leading-5 text-[var(--text-muted)]">
            <div>{topic?.scope ?? 'topic'}</div>
            <div>{topic?.valueKind ?? 'unknown'}</div>
          </div>
        ) : null}
      </div>
      <div className="font-mono text-[clamp(1.4rem,1.15rem+1vw,2.5rem)] leading-none tracking-[-0.05em] text-[var(--text)]">
        {formatNumberValue(value, widget.config.decimals, widget.config.units)}
      </div>
      <div className="text-[0.78rem] leading-6 text-[var(--text-muted)]">
        {density === 'large' ? topic?.key ?? 'Select a topic to bind this widget.' : topic?.valueText ?? '--'}
      </div>
    </div>
  )
}

function GaugeView({
  value,
  widget,
}: {
  value: number | null
  widget: HomeWorkspaceTopicWidget
}) {
  const tone = evaluateNumericTone(value, widget)
  const accent = toneAccent(tone)
  const min = widget.config.criticalMin ?? widget.config.warningMin ?? 0
  const max = widget.config.criticalMax ?? widget.config.warningMax ?? 100
  const normalized = value === null ? 0 : clamp((value - min) / Math.max(0.0001, max - min), 0, 1)
  const angle = -135 + normalized * 270
  const marker = polarToCartesian(84, 84, 54, angle)

  return (
    <div className="grid h-full min-h-0 gap-3 lg:grid-cols-[168px_minmax(0,1fr)] lg:items-center">
      <svg viewBox="0 0 168 120" className="mx-auto w-full max-w-[188px]">
        <path d={describeArc(84, 84, 54, -135, 135)} fill="none" stroke="var(--border)" strokeWidth="10" opacity="0.42" />
        <path d={describeArc(84, 84, 54, -135, angle)} fill="none" stroke={accent.color} strokeWidth="10" strokeLinecap="round" />
        <circle cx={marker.x} cy={marker.y} r="5" fill={accent.color} />
        <text x="84" y="74" textAnchor="middle" className="fill-[var(--text)] text-[18px] font-semibold">
          {formatNumberValue(value, widget.config.decimals, widget.config.units)}
        </text>
      </svg>

      <div className="grid gap-3">
        <div className="text-[0.72rem] uppercase tracking-[0.14em]" style={{ color: accent.color }}>
          Gauge window
        </div>
        <div className="rounded-[16px] border border-[var(--border)] bg-[var(--surface)]/72 px-3 py-3 text-[0.78rem] leading-6 text-[var(--text-muted)]">
          <div>
            Min {formatNumberValue(min, widget.config.decimals, widget.config.units)}
          </div>
          <div>
            Max {formatNumberValue(max, widget.config.decimals, widget.config.units)}
          </div>
        </div>
      </div>
    </div>
  )
}

function BarView({
  value,
  widget,
}: {
  value: number | null
  widget: HomeWorkspaceTopicWidget
}) {
  const tone = evaluateNumericTone(value, widget)
  const accent = toneAccent(tone)
  const min = widget.config.criticalMin ?? widget.config.warningMin ?? 0
  const max = widget.config.criticalMax ?? widget.config.warningMax ?? 100
  const fill = value === null ? 0 : clamp(((value - min) / Math.max(0.0001, max - min)) * 100, 0, 100)

  return (
    <div className="flex h-full flex-col justify-between gap-3">
      <div className="flex items-end justify-between gap-3">
        <div className="font-mono text-[clamp(1.35rem,1.12rem+0.9vw,2.2rem)] leading-none tracking-[-0.05em] text-[var(--text)]">
          {formatNumberValue(value, widget.config.decimals, widget.config.units)}
        </div>
        <div className="text-[0.72rem] uppercase tracking-[0.14em]" style={{ color: accent.color }}>
          {tone}
        </div>
      </div>
      <div className="relative h-5 overflow-hidden rounded-full border border-[var(--border)] bg-[var(--surface)]/76">
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            width: `${fill}%`,
            background: `linear-gradient(90deg, ${accent.color} 0%, ${accent.soft} 100%)`,
          }}
        />
      </div>
      <div className="flex items-center justify-between gap-3 text-[0.72rem] leading-6 text-[var(--text-muted)]">
        <div>{formatNumberValue(min, widget.config.decimals, widget.config.units)}</div>
        <div>{formatNumberValue(max, widget.config.decimals, widget.config.units)}</div>
      </div>
    </div>
  )
}

function SparklineView({
  value,
  widget,
  history,
}: {
  value: number | null
  widget: HomeWorkspaceTopicWidget
  history: WorkspaceHistoryPoint[]
}) {
  const tone = evaluateNumericTone(value, widget)
  const accent = toneAccent(tone)
  const values = history.length ? history.map((point) => point.value) : value === null ? [0, 0] : [value, value]
  const min = Math.min(...values)
  const max = Math.max(...values)
  const path = buildSparklinePath(history.length > 1 ? history : [{ timestamp: '0', value: min }, { timestamp: '1', value: max }], min, max, 460, 128)

  return (
    <div className="grid h-full min-h-0 gap-3">
      <div className="flex items-end justify-between gap-3">
        <div className="font-mono text-[clamp(1.6rem,1.2rem+1vw,2.45rem)] leading-none tracking-[-0.05em] text-[var(--text)]">
          {formatNumberValue(value, widget.config.decimals, widget.config.units)}
        </div>
        <div className="text-[0.72rem] uppercase tracking-[0.14em]" style={{ color: accent.color }}>
          {history.length > 1 ? `${history.length} pts` : 'warming up'}
        </div>
      </div>
      <div className="min-h-0 rounded-[18px] border border-[var(--border)] bg-[var(--surface)]/74 px-3 py-3">
        <svg viewBox="0 0 460 128" className="h-full min-h-[108px] w-full">
          <path d={path} fill="none" stroke={accent.color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  )
}

function BooleanLightView({
  value,
}: {
  value: boolean | null
}) {
  const on = Boolean(value)
  const accent = toneAccent(on ? 'good' : 'neutral')

  return (
    <div className="flex h-full items-center gap-3">
      <div
        className="h-5 w-5 rounded-full border"
        style={{
          borderColor: on ? accent.color : 'var(--border)',
          backgroundColor: on ? accent.color : 'var(--surface-alt)',
          boxShadow: on ? `0 0 0 6px ${accent.soft}` : 'none',
        }}
      />
      <div className="text-[0.84rem] uppercase tracking-[0.16em] text-[var(--text-muted)]">
        {value === null ? 'Unknown' : on ? 'On' : 'Off'}
      </div>
    </div>
  )
}

function BooleanPillView({
  value,
}: {
  value: boolean | null
}) {
  const on = Boolean(value)
  const accent = toneAccent(on ? 'good' : 'neutral')

  return (
    <div className="flex h-full items-center">
      <div
        className="inline-flex items-center gap-3 rounded-full border px-4 py-2"
        style={{
          borderColor: accent.border,
          background: on ? accent.soft : 'var(--surface)',
        }}
      >
        <span className="h-3 w-3 rounded-full" style={{ background: on ? accent.color : 'var(--text-muted)' }} />
        <span className="text-[0.82rem] font-semibold uppercase tracking-[0.16em] text-[var(--text)]">
          {value === null ? 'Unknown' : on ? 'Active' : 'Idle'}
        </span>
      </div>
    </div>
  )
}

function BooleanTileView({
  value,
  topic,
}: {
  value: boolean | null
  topic: TelemetryTopic | null
}) {
  const on = Boolean(value)
  const accent = toneAccent(on ? 'good' : 'neutral')

  return (
    <div
      className="grid h-full min-h-0 content-between rounded-[18px] border px-4 py-4"
      style={{
        borderColor: accent.border,
        background: on ? accent.soft : 'var(--surface)',
      }}
    >
      <div className="text-[0.72rem] uppercase tracking-[0.14em]" style={{ color: accent.color }}>
        Boolean tile
      </div>
      <div className="text-[clamp(1.35rem,1.1rem+0.9vw,2.1rem)] font-semibold tracking-[-0.04em] text-[var(--text)]">
        {value === null ? '--' : on ? 'ENABLED' : 'DISABLED'}
      </div>
      <div className="text-[0.78rem] leading-6 text-[var(--text-muted)]">{topic?.valueText ?? 'Waiting for live state.'}</div>
    </div>
  )
}

function TextLineView({
  topic,
}: {
  topic: TelemetryTopic | null
}) {
  return (
    <div className="grid h-full min-h-0 gap-3">
      <div className="font-mono text-[0.95rem] leading-7 text-[var(--text)]">
        {topic?.valueText ?? '--'}
      </div>
      <div className="text-[0.74rem] leading-6 text-[var(--text-muted)]">{topic?.key ?? 'Bind a topic to show text.'}</div>
    </div>
  )
}

function TextTileView({
  topic,
}: {
  topic: TelemetryTopic | null
}) {
  return (
    <div className="grid h-full min-h-0 content-between rounded-[18px] border border-[var(--border)] bg-[var(--surface)]/72 px-4 py-4">
      <div className="text-[0.72rem] uppercase tracking-[0.14em] text-[var(--text-muted)]">Text readout</div>
      <div className="break-words text-[clamp(1.1rem,0.95rem+0.7vw,1.85rem)] leading-[1.2] tracking-[-0.03em] text-[var(--text)]">
        {topic?.valueText ?? '--'}
      </div>
      <div className="text-[0.74rem] leading-6 text-[var(--text-muted)]">{topic?.key ?? 'Assign a live topic to this widget.'}</div>
    </div>
  )
}

function PresetWorkspaceWidgetRenderer({
  widget,
  snapshot,
  derived,
  alerts,
  batteryHistory,
}: {
  widget: HomeWorkspaceWidget
  snapshot: TelemetrySnapshot
  derived: TelemetryDerivedState
  alerts: AlertItem[]
  batteryHistory: BatteryHistoryPoint[]
}) {
  if (!isHomeWorkspacePresetWidget(widget)) {
    return null
  }

  if (widget.presetId === 'battery-watch') {
    return <BatteryPanelBody battery={snapshot.battery} history={batteryHistory} />
  }

  if (widget.presetId === 'heading-gyro') {
    return <HeadingPanelBody data={snapshot.heading} />
  }

  if (widget.presetId === 'systems-health') {
    return <SystemsHealthPanelBody data={snapshot.systems} />
  }

  if (widget.presetId === 'commands') {
    return <CommandsPanelBody data={snapshot.commands} derived={derived} />
  }

  if (widget.presetId === 'alerts') {
    return <AlertsPanelBody alerts={alerts} />
  }

  return (
    <WidgetEmptyState
      title="Preset unavailable"
      subtitle="This preset is not registered in the current workspace runtime."
    />
  )
}

export function HomeWorkspaceWidgetRenderer({
  widget,
  topic,
  history,
  snapshot,
  derived,
  alerts,
  batteryHistory,
}: {
  widget: HomeWorkspaceWidget
  topic: TelemetryTopic | null
  history: WorkspaceHistoryPoint[]
  snapshot: TelemetrySnapshot
  derived: TelemetryDerivedState
  alerts: AlertItem[]
  batteryHistory: BatteryHistoryPoint[]
}) {
  if (isHomeWorkspacePresetWidget(widget)) {
    return (
      <PresetWorkspaceWidgetRenderer
        widget={widget}
        snapshot={snapshot}
        derived={derived}
        alerts={alerts}
        batteryHistory={batteryHistory}
      />
    )
  }

  const density = resolveWidgetDensity(widget)

  if (widget.topicKey === null) {
    return (
      <WidgetEmptyState
        title="Unassigned widget"
        subtitle="Choose a telemetry topic in widget settings to bind this card to a live data source."
      />
    )
  }

  if (!topic) {
    return (
      <WidgetEmptyState
        title="Topic unavailable"
        subtitle="This widget is still bound, but the selected topic is not present in the current live catalog."
      />
    )
  }

  const numericValue = getNumericTopicValue(topic)
  const booleanValue = topic.valueKind === 'boolean' && typeof topic.value === 'boolean' ? topic.value : null
  const activeRenderer = resolveRenderer(widget, topic, density)

  if (activeRenderer === 'number') {
    return <NumberView value={numericValue} widget={widget} density={density} topic={topic} />
  }

  if (activeRenderer === 'stat') {
    return <StatView value={numericValue} widget={widget} density={density} topic={topic} />
  }

  if (activeRenderer === 'gauge') {
    return <GaugeView value={numericValue} widget={widget} />
  }

  if (activeRenderer === 'bar') {
    return <BarView value={numericValue} widget={widget} />
  }

  if (activeRenderer === 'sparkline') {
    return <SparklineView value={numericValue} widget={widget} history={history} />
  }

  if (activeRenderer === 'boolean-light') {
    return <BooleanLightView value={booleanValue} />
  }

  if (activeRenderer === 'boolean-pill') {
    return <BooleanPillView value={booleanValue} />
  }

  if (activeRenderer === 'boolean-tile') {
    return <BooleanTileView value={booleanValue} topic={topic} />
  }

  if (activeRenderer === 'text-tile') {
    return <TextTileView topic={topic} />
  }

  return <TextLineView topic={topic} />
}
