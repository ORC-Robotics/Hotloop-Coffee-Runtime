import { startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { writeTelemetryTopicValue } from '../../data/robotBridge'
import { useTelemetryCatalog } from '../../hooks/useTelemetryCatalog'
import { cn } from '../../lib/cn'
import { clamp, formatClock } from '../../lib/format'
import type { TelemetryTopic, TelemetryTopicScope, TopicWriteCommand } from '../../types/telemetry'
import { DashboardCard } from './DashboardCard'
import { StatusBadge } from './StatusBadge'

const STORAGE_KEY = 'orion.custom-telemetry-board.v2'
const LEGACY_STORAGE_KEY = 'orion.custom-telemetry-board.v1'
const RESULT_LIMIT = 80
const HISTORY_LIMIT = 96

type ScopeFilter = 'all' | TelemetryTopicScope
type WritableKind = TopicWriteCommand['payload']['valueKind']
type WidgetDisplayMode = 'auto' | 'text' | 'boolean' | 'gauge' | 'bar' | 'graph'
type ResolvedWidgetDisplayMode = Exclude<WidgetDisplayMode, 'auto'>
type WidgetBooleanCondition = 'gte' | 'lte'
type WidgetCardSize = 'compact' | 'standard' | 'wide' | 'tall' | 'hero'
type WidgetStatusTone = 'good' | 'warning' | 'critical' | 'neutral'
type WidgetHistoryPoint = { timestamp: string; value: number }

interface PinnedTopicWidget {
  key: string
  displayMode: WidgetDisplayMode
  cardSize: WidgetCardSize
  rangeMin: number | null
  rangeMax: number | null
  decimals: number
  booleanCondition: WidgetBooleanCondition
  booleanThreshold: number | null
  warningMin: number | null
  warningMax: number | null
  criticalMin: number | null
  criticalMax: number | null
}

function clampDecimals(value: number) {
  return Math.max(0, Math.min(4, Math.round(value)))
}

function parseOptionalNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function getNumericTopicValue(topic: TelemetryTopic | null) {
  if (!topic || topic.valueKind !== 'number' || typeof topic.value !== 'number' || !Number.isFinite(topic.value)) {
    return null
  }

  return topic.value
}

function inferDefaultDecimals(topic: TelemetryTopic | null) {
  const value = Math.abs(getNumericTopicValue(topic) ?? 0)
  const context = `${topic?.key ?? ''} ${topic?.label ?? ''}`.toLowerCase()

  if (/voltage|current|power|gain|kp|ki|kd|threshold|offset|bias|factor/.test(context)) {
    return 2
  }

  if (/yaw|heading|angle|distance|mm|cm|meter|state time|runtime|speed|velocity|accel/.test(context)) {
    return value >= 100 ? 0 : 1
  }

  if (value >= 100) {
    return 0
  }

  if (value >= 10) {
    return 1
  }

  return 2
}

function createDefaultPinnedWidget(key: string, topic: TelemetryTopic | null = null): PinnedTopicWidget {
  return {
    key,
    displayMode: 'auto',
    cardSize: topic?.valueKind === 'boolean' ? 'compact' : 'standard',
    rangeMin: null,
    rangeMax: null,
    decimals: inferDefaultDecimals(topic),
    booleanCondition: 'gte',
    booleanThreshold: null,
    warningMin: null,
    warningMax: null,
    criticalMin: null,
    criticalMax: null,
  }
}

function parsePinnedWidget(raw: unknown): PinnedTopicWidget | null {
  if (!raw || typeof raw !== 'object') {
    return null
  }

  const candidate = raw as Partial<PinnedTopicWidget>
  if (typeof candidate.key !== 'string' || !candidate.key.trim()) {
    return null
  }

  const displayMode: WidgetDisplayMode =
    candidate.displayMode === 'text' ||
    candidate.displayMode === 'boolean' ||
    candidate.displayMode === 'gauge' ||
    candidate.displayMode === 'bar' ||
    candidate.displayMode === 'graph'
      ? candidate.displayMode
      : 'auto'

  const cardSize: WidgetCardSize =
    candidate.cardSize === 'compact' ||
    candidate.cardSize === 'standard' ||
    candidate.cardSize === 'wide' ||
    candidate.cardSize === 'tall' ||
    candidate.cardSize === 'hero'
      ? candidate.cardSize
      : 'standard'

  const booleanCondition: WidgetBooleanCondition =
    candidate.booleanCondition === 'lte' ? 'lte' : 'gte'

  return {
    key: candidate.key,
    displayMode,
    cardSize,
    rangeMin: parseOptionalNumber(candidate.rangeMin),
    rangeMax: parseOptionalNumber(candidate.rangeMax),
    decimals:
      typeof candidate.decimals === 'number' && Number.isFinite(candidate.decimals)
        ? clampDecimals(candidate.decimals)
        : 2,
    booleanCondition,
    booleanThreshold: parseOptionalNumber(candidate.booleanThreshold),
    warningMin: parseOptionalNumber(candidate.warningMin),
    warningMax: parseOptionalNumber(candidate.warningMax),
    criticalMin: parseOptionalNumber(candidate.criticalMin),
    criticalMax: parseOptionalNumber(candidate.criticalMax),
  }
}

function loadLegacyPinnedWidgets(): PinnedTopicWidget[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(LEGACY_STORAGE_KEY) ?? '[]')
    if (!Array.isArray(parsed)) {
      return []
    }

    const deduped = new Set<string>()
    return parsed
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      .filter((value) => {
        if (deduped.has(value)) {
          return false
        }

        deduped.add(value)
        return true
      })
      .map((key) => createDefaultPinnedWidget(key))
  } catch {
    return []
  }
}

function loadPinnedWidgets(): PinnedTopicWidget[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]')
    if (Array.isArray(parsed)) {
      const deduped = new Set<string>()
      return parsed
        .map((item) => parsePinnedWidget(item))
        .filter((item): item is PinnedTopicWidget => item !== null)
        .filter((item) => {
          if (deduped.has(item.key)) {
            return false
          }

          deduped.add(item.key)
          return true
        })
    }
  } catch {
    return loadLegacyPinnedWidgets()
  }

  return loadLegacyPinnedWidgets()
}

function scopeLabel(scope: TelemetryTopicScope) {
  if (scope === 'telemetry') return 'Telemetry'
  if (scope === 'debug') return 'Debug'
  if (scope === 'config') return 'Config'
  if (scope === 'auto-mode') return 'Auto Mode'
  return 'Other'
}

function scopeChipClass(scope: TelemetryTopicScope) {
  if (scope === 'telemetry') {
    return 'border-[var(--primary)]/28 bg-[var(--primary-soft)]/72 text-[var(--text)]'
  }

  if (scope === 'debug') {
    return 'border-[var(--warning)]/28 bg-[color-mix(in_srgb,var(--warning)_14%,transparent)] text-[var(--text)]'
  }

  if (scope === 'config') {
    return 'border-[var(--info)]/28 bg-[color-mix(in_srgb,var(--info)_14%,transparent)] text-[var(--text)]'
  }

  if (scope === 'auto-mode') {
    return 'border-[var(--accent)]/28 bg-[var(--accent-soft)]/72 text-[var(--text)]'
  }

  return 'border-[var(--success)]/28 bg-[color-mix(in_srgb,var(--success)_14%,transparent)] text-[var(--text)]'
}

function summaryToneClass(tone: 'good' | 'warning' | 'info' | 'neutral') {
  if (tone === 'good') {
    return 'border-[var(--success)]/24 bg-[color-mix(in_srgb,var(--success)_10%,var(--surface)_90%)]'
  }

  if (tone === 'warning') {
    return 'border-[var(--warning)]/24 bg-[color-mix(in_srgb,var(--warning)_10%,var(--surface)_90%)]'
  }

  if (tone === 'info') {
    return 'border-[var(--info)]/24 bg-[color-mix(in_srgb,var(--info)_10%,var(--surface)_90%)]'
  }

  return 'border-[var(--border)] bg-[var(--surface)]/84'
}

function isSearchMatch(topic: TelemetryTopic, query: string) {
  if (!query) {
    return true
  }

  const searchable = `${topic.key} ${topic.label} ${topic.groupPath} ${topic.valueText}`.toLowerCase()
  return searchable.includes(query)
}

function getWritableKind(topic: TelemetryTopic | null): WritableKind | null {
  if (!topic || !topic.isWritable) {
    return null
  }

  if (topic.valueKind === 'number' || topic.valueKind === 'boolean' || topic.valueKind === 'string') {
    return topic.valueKind
  }

  return null
}

function createDraftFromTopic(topic: TelemetryTopic | null): string | boolean {
  if (!topic) {
    return ''
  }

  if (topic.valueKind === 'boolean') {
    return Boolean(topic.value)
  }

  if (topic.value === null) {
    return ''
  }

  return String(topic.value)
}

function niceCeiling(rawValue: number) {
  const safeValue = Math.max(1, rawValue)
  const exponent = Math.floor(Math.log10(safeValue))
  const magnitude = 10 ** exponent
  const normalized = safeValue / magnitude
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10
  return step * magnitude
}

function inferNumericRange(topic: TelemetryTopic | null, history: WidgetHistoryPoint[]) {
  const value = getNumericTopicValue(topic)
  const historyValues = history.map((point) => point.value)
  const combinedValues = value === null ? historyValues : [...historyValues, value]
  const absolutePeak = combinedValues.length
    ? combinedValues.reduce((peak, current) => Math.max(peak, Math.abs(current)), 0)
    : 1
  const signed = combinedValues.some((item) => item < 0)
  const context = `${topic?.key ?? ''} ${topic?.label ?? ''}`.toLowerCase()

  if (/yaw|heading|pitch|roll|gyro|angle/.test(context)) {
    return { min: -180, max: 180 }
  }

  if (/state of charge|percent|percentage/.test(context)) {
    return { min: 0, max: 100 }
  }

  if (/voltage/.test(context)) {
    return { min: 0, max: 14 }
  }

  if (/current/.test(context)) {
    return { min: 0, max: 120 }
  }

  if (/power/.test(context)) {
    return { min: 0, max: 500 }
  }

  if (/temperature|temp/.test(context)) {
    return { min: 0, max: 100 }
  }

  if (/accel|acceleration|speed|velocity|rate|rpm/.test(context)) {
    const ceiling = niceCeiling(Math.max(absolutePeak * 1.2, 1))
    return signed ? { min: -ceiling, max: ceiling } : { min: 0, max: ceiling }
  }

  if (value !== null && Math.abs(value) <= 1.2) {
    return { min: -1, max: 1 }
  }

  if (signed) {
    const ceiling = niceCeiling(Math.max(absolutePeak * 1.15, 1))
    return { min: -ceiling, max: ceiling }
  }

  return { min: 0, max: niceCeiling(Math.max(absolutePeak * 1.25, 1)) }
}

function resolveDisplayMode(topic: TelemetryTopic | null, displayMode: WidgetDisplayMode): ResolvedWidgetDisplayMode {
  if (!topic) {
    return 'text'
  }

  if (displayMode !== 'auto') {
    return displayMode
  }

  const context = `${topic.key} ${topic.label}`.toLowerCase()
  const numericValue = getNumericTopicValue(topic)

  if (topic.valueKind === 'boolean') {
    return 'boolean'
  }

  if (topic.valueKind !== 'number') {
    return 'text'
  }

  if (/kp|ki|kd|gain|threshold|offset|trim|bias|scale|factor|limit/.test(context)) {
    return 'text'
  }

  if (/forward|rotation|turn output|cmd|command|throttle|steer|joystick|input/.test(context) || (numericValue !== null && Math.abs(numericValue) <= 1.2)) {
    return 'bar'
  }

  if (/voltage|current|power|accel|acceleration|speed|velocity|rate|temp|temperature/.test(context)) {
    return 'graph'
  }

  return 'gauge'
}

function displayModeLabel(displayMode: WidgetDisplayMode) {
  if (displayMode === 'auto') return 'Auto'
  if (displayMode === 'text') return 'Text'
  if (displayMode === 'boolean') return 'Boolean'
  if (displayMode === 'gauge') return 'Gauge'
  if (displayMode === 'bar') return 'Bar'
  return 'Graph'
}

function getDisplayModeOptions(topic: TelemetryTopic | null): WidgetDisplayMode[] {
  if (!topic) {
    return ['auto', 'text']
  }

  if (topic.valueKind === 'boolean') {
    return ['auto', 'boolean', 'text']
  }

  if (topic.valueKind === 'number') {
    return ['auto', 'text', 'boolean', 'gauge', 'bar', 'graph']
  }

  return ['auto', 'text']
}

function cardSizeLabel(cardSize: WidgetCardSize) {
  if (cardSize === 'compact') return 'Compact'
  if (cardSize === 'standard') return 'Standard'
  if (cardSize === 'wide') return 'Wide'
  if (cardSize === 'tall') return 'Tall'
  return 'Hero'
}

function cardSizeClass(cardSize: WidgetCardSize, displayMode: ResolvedWidgetDisplayMode) {
  const defaultWide = displayMode === 'graph' ? 'md:col-span-2' : ''

  if (cardSize === 'compact') {
    return 'min-h-[250px]'
  }

  if (cardSize === 'wide') {
    return 'md:col-span-2 min-h-[320px]'
  }

  if (cardSize === 'tall') {
    return 'min-h-[520px]'
  }

  if (cardSize === 'hero') {
    return 'md:col-span-2 min-h-[560px]'
  }

  return cn('min-h-[320px]', defaultWide)
}

function widgetToneLabel(tone: WidgetStatusTone) {
  if (tone === 'good') return 'nominal'
  if (tone === 'warning') return 'warning'
  if (tone === 'critical') return 'critical'
  return 'neutral'
}

function widgetToneToBadgeTone(tone: WidgetStatusTone) {
  if (tone === 'good') return 'good'
  if (tone === 'warning') return 'warning'
  if (tone === 'critical') return 'critical'
  return 'neutral'
}

function widgetToneAccent(tone: WidgetStatusTone) {
  if (tone === 'critical') {
    return {
      color: 'var(--danger)',
      soft: 'var(--danger-soft)',
      border: 'rgba(191, 110, 114, 0.28)',
    }
  }

  if (tone === 'warning') {
    return {
      color: 'var(--warning)',
      soft: 'var(--warning-soft)',
      border: 'rgba(194, 138, 71, 0.28)',
    }
  }

  if (tone === 'good') {
    return {
      color: 'var(--success)',
      soft: 'var(--success-soft)',
      border: 'rgba(90, 143, 121, 0.28)',
    }
  }

  return {
    color: 'var(--primary)',
    soft: 'var(--primary-soft)',
    border: 'rgba(109, 146, 207, 0.28)',
  }
}

function normalizeRange(min: number, max: number) {
  if (min === max) {
    return { min: min - 1, max: max + 1 }
  }

  if (min < max) {
    return { min, max }
  }

  return { min: max, max: min }
}

function resolveNumericRange(widget: PinnedTopicWidget, topic: TelemetryTopic | null, history: WidgetHistoryPoint[]) {
  const inferred = inferNumericRange(topic, history)
  const rawMin = widget.rangeMin ?? inferred.min
  const rawMax = widget.rangeMax ?? inferred.max
  const normalized = normalizeRange(rawMin, rawMax)

  return {
    ...normalized,
    inferredMin: inferred.min,
    inferredMax: inferred.max,
  }
}

function formatNumberValue(value: number, decimals: number) {
  return value.toFixed(clampDecimals(decimals))
}

function formatWidgetValue(topic: TelemetryTopic | null, decimals: number) {
  const numericValue = getNumericTopicValue(topic)
  if (numericValue !== null) {
    return formatNumberValue(numericValue, decimals)
  }

  if (topic?.valueKind === 'boolean') {
    return topic.value ? 'true' : 'false'
  }

  return topic?.valueText ?? '--'
}

function resolveBooleanThreshold(widget: PinnedTopicWidget, range: { min: number; max: number }) {
  return widget.booleanThreshold ?? (range.min + range.max) / 2
}

function resolveBooleanDisplayValue(
  topic: TelemetryTopic | null,
  widget: PinnedTopicWidget,
  range: { min: number; max: number },
) {
  if (!topic) {
    return null
  }

  if (topic.valueKind === 'boolean') {
    return Boolean(topic.value)
  }

  const numericValue = getNumericTopicValue(topic)
  if (numericValue === null) {
    return null
  }

  const threshold = resolveBooleanThreshold(widget, range)
  return widget.booleanCondition === 'lte' ? numericValue <= threshold : numericValue >= threshold
}

function evaluateWidgetTone(value: number | null, widget: PinnedTopicWidget): WidgetStatusTone {
  if (value === null) {
    return 'neutral'
  }

  if (
    (widget.criticalMin !== null && value < widget.criticalMin) ||
    (widget.criticalMax !== null && value > widget.criticalMax)
  ) {
    return 'critical'
  }

  if (
    (widget.warningMin !== null && value < widget.warningMin) ||
    (widget.warningMax !== null && value > widget.warningMax)
  ) {
    return 'warning'
  }

  if (
    widget.warningMin !== null ||
    widget.warningMax !== null ||
    widget.criticalMin !== null ||
    widget.criticalMax !== null
  ) {
    return 'good'
  }

  return 'neutral'
}

function polarToCartesian(centerX: number, centerY: number, radius: number, angleDeg: number) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180
  return {
    x: centerX + radius * Math.cos(angleRad),
    y: centerY + radius * Math.sin(angleRad),
  }
}

function describeArc(centerX: number, centerY: number, radius: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(centerX, centerY, radius, endAngle)
  const end = polarToCartesian(centerX, centerY, radius, startAngle)
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1'
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`
}

function buildSparklinePath(history: WidgetHistoryPoint[], min: number, max: number, width: number, height: number) {
  if (!history.length) {
    return ''
  }

  const safeRange = Math.max(0.0001, max - min)
  return history
    .map((point, index) => {
      const x = history.length === 1 ? width / 2 : (index / (history.length - 1)) * width
      const y = height - ((clamp(point.value, min, max) - min) / safeRange) * height
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join(' ')
}

function SummaryTile({
  label,
  value,
  detail,
  tone,
}: {
  label: string
  value: string
  detail: string
  tone: 'good' | 'warning' | 'info' | 'neutral'
}) {
  return (
    <div className={cn('rounded-[20px] border px-4 py-3', summaryToneClass(tone))} style={{ boxShadow: 'var(--card-shadow)' }}>
      <div className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">{label}</div>
      <div className="mt-2 text-[1.35rem] font-semibold tracking-[-0.04em] text-[var(--text)]">{value}</div>
      <div className="mt-1 text-[0.8rem] leading-6 text-[var(--text-muted)]">{detail}</div>
    </div>
  )
}

function CatalogTopicRow({
  topic,
  pinned,
  onAdd,
}: {
  topic: TelemetryTopic
  pinned: boolean
  onAdd: (topic: TelemetryTopic) => void
}) {
  return (
    <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface-alt)]/82 px-3 py-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-[0.86rem] font-semibold tracking-[-0.02em] text-[var(--text)]">{topic.label}</div>
            <div
              className={cn(
                'rounded-full border px-2.5 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.14em]',
                scopeChipClass(topic.scope),
              )}
            >
              {scopeLabel(topic.scope)}
            </div>
            {topic.persistent ? (
              <div className="rounded-full border border-[var(--border)] px-2.5 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                persistent
              </div>
            ) : null}
            {topic.isWritable ? <StatusBadge tone="info" label="editable" /> : null}
          </div>

          <div className="mt-1 break-all font-mono text-[0.72rem] leading-6 text-[var(--text-muted)]">
            {topic.key}
          </div>

          <div className="mt-2 text-[0.76rem] leading-6 text-[var(--text-muted)]">
            Group {topic.groupPath || 'root'} / {topic.valueKind}
          </div>
        </div>

        <div className="flex flex-col items-start gap-2 lg:items-end">
          <div className="max-w-[280px] break-all font-mono text-[0.84rem] leading-6 text-[var(--text)] lg:text-right">
            {topic.valueText}
          </div>
          <button
            type="button"
            onClick={() => onAdd(topic)}
            disabled={pinned}
            className={cn(
              'rounded-full border px-3 py-2 text-[0.72rem] font-semibold uppercase tracking-[0.14em] transition-colors',
              pinned
                ? 'cursor-default border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)]'
                : 'border-[var(--accent)]/28 bg-[var(--accent-soft)]/78 text-[var(--text)] hover:bg-[var(--accent-soft)]',
            )}
          >
            {pinned ? 'Pinned' : 'Add to board'}
          </button>
        </div>
      </div>
    </div>
  )
}

function TextWidgetView({
  topic,
  valueText,
}: {
  topic: TelemetryTopic | null
  valueText: string
}) {
  const compactValue = valueText.length > 44 || Boolean(topic?.valueKind.endsWith('array'))

  return (
    <>
      <div
        className={cn(
          'mt-5 break-all font-mono tracking-[-0.04em] text-[var(--text)]',
          compactValue ? 'text-[1rem] leading-7' : 'text-[clamp(1.65rem,1.35rem+1vw,2.6rem)] leading-none',
          topic === null && 'text-[var(--warning)]',
        )}
      >
        {valueText}
      </div>
      <div className="mt-3 text-[0.74rem] leading-6 text-[var(--text-muted)]">
        {topic?.valueText ?? 'Current robot is not publishing this topic.'}
      </div>
    </>
  )
}

function BooleanWidgetView({
  topic,
  value,
  label,
  tone,
}: {
  topic: TelemetryTopic | null
  value: boolean | null
  label: string
  tone: WidgetStatusTone
}) {
  const isActive = Boolean(value)
  const accent = widgetToneAccent(tone)

  return (
    <div
      className="mt-5 rounded-[20px] border bg-[var(--surface)]/75 px-4 py-4"
      style={{ borderColor: accent.border }}
    >
      <div className="flex items-center gap-4">
        <div
          className={cn(
            'h-5 w-5 rounded-full border',
            isActive
              ? ''
              : 'border-[var(--border-strong)] bg-[var(--surface-alt)]',
          )}
          style={
            isActive
              ? {
                  borderColor: accent.color,
                  backgroundColor: accent.color,
                  boxShadow: `0 0 0 6px color-mix(in srgb, ${accent.color} 16%, transparent)`,
                }
              : undefined
          }
        />
        <div className="min-w-0">
          <div className="text-[1.5rem] font-semibold tracking-[-0.04em] text-[var(--text)]">
            {value === null ? '--' : isActive ? 'true' : 'false'}
          </div>
          <div className="text-[0.66rem] font-semibold uppercase tracking-[0.14em]" style={{ color: accent.color }}>
            {label}
          </div>
          <div className="text-[0.74rem] leading-6 text-[var(--text-muted)]">
            {topic?.valueText ?? 'Missing from the current live catalog.'}
          </div>
        </div>
      </div>
    </div>
  )
}

function GaugeWidgetView({
  topic,
  value,
  min,
  max,
  decimals,
  tone,
}: {
  topic: TelemetryTopic | null
  value: number | null
  min: number
  max: number
  decimals: number
  tone: WidgetStatusTone
}) {
  if (value === null) {
    return <TextWidgetView topic={topic} valueText={topic?.valueText ?? '--'} />
  }

  const accent = widgetToneAccent(tone)
  const normalized = clamp((value - min) / Math.max(0.0001, max - min), 0, 1)
  const startAngle = -135
  const endAngle = 135
  const pointerAngle = startAngle + normalized * (endAngle - startAngle)
  const trackPath = describeArc(80, 80, 54, startAngle, endAngle)
  const activePath = describeArc(80, 80, 54, startAngle, pointerAngle)
  const marker = polarToCartesian(80, 80, 54, pointerAngle)
  const outOfRange = value < min || value > max

  return (
    <div
      className="mt-5 rounded-[20px] border bg-[var(--surface)]/75 px-4 py-4"
      style={{ borderColor: accent.border }}
    >
      <div className="grid items-center gap-3 lg:grid-cols-[160px_minmax(0,1fr)]">
        <svg viewBox="0 0 160 120" className="mx-auto w-full max-w-[180px]">
          <path d={trackPath} fill="none" stroke="var(--border-strong)" strokeWidth="10" strokeLinecap="round" opacity="0.36" />
          <path d={activePath} fill="none" stroke={accent.color} strokeWidth="10" strokeLinecap="round" />
          <circle cx={marker.x} cy={marker.y} r="5" fill={outOfRange ? 'var(--warning)' : accent.color} />
          <text x="80" y="72" textAnchor="middle" className="fill-[var(--text)] text-[18px] font-semibold">
            {formatNumberValue(value, decimals)}
          </text>
          <text x="80" y="90" textAnchor="middle" className="text-[11px] uppercase tracking-[0.14em]" fill={accent.color}>
            {widgetToneLabel(tone)}
          </text>
        </svg>

        <div className="grid gap-3">
          <div className="flex items-center justify-between gap-3 text-[0.72rem] uppercase tracking-[0.14em] text-[var(--text-muted)]">
            <span>Window</span>
            <span>{formatNumberValue(min, decimals)} to {formatNumberValue(max, decimals)}</span>
          </div>
          <div className="rounded-[16px] border border-[var(--border)] bg-[var(--surface-alt)]/78 px-3 py-3 text-[0.82rem] leading-6 text-[var(--text-muted)]">
            {outOfRange
              ? `Value is outside the configured window. The gauge is clamped to the edge while the raw value remains ${topic?.valueText ?? '--'}.`
              : topic?.valueText ?? 'Waiting for a live value.'}
          </div>
        </div>
      </div>
    </div>
  )
}

function BarWidgetView({
  topic,
  value,
  min,
  max,
  decimals,
  tone,
}: {
  topic: TelemetryTopic | null
  value: number | null
  min: number
  max: number
  decimals: number
  tone: WidgetStatusTone
}) {
  if (value === null) {
    return <TextWidgetView topic={topic} valueText={topic?.valueText ?? '--'} />
  }

  const accent = widgetToneAccent(tone)
  const safeRange = Math.max(0.0001, max - min)
  const zeroPosition = min < 0 && max > 0 ? ((0 - min) / safeRange) * 100 : min >= 0 ? 0 : 100
  const valuePosition = clamp(((value - min) / safeRange) * 100, 0, 100)
  const fillStart = min < 0 && max > 0 ? Math.min(zeroPosition, valuePosition) : 0
  const fillWidth = min < 0 && max > 0 ? Math.abs(valuePosition - zeroPosition) : valuePosition

  return (
    <div
      className="mt-5 rounded-[20px] border bg-[var(--surface)]/75 px-4 py-4"
      style={{ borderColor: accent.border }}
    >
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Current value</div>
          <div className="mt-2 font-mono text-[clamp(1.5rem,1.3rem+0.8vw,2.2rem)] leading-none tracking-[-0.04em] text-[var(--text)]">
            {formatNumberValue(value, decimals)}
          </div>
        </div>
        <div className="text-right text-[0.74rem] leading-6 text-[var(--text-muted)]">
          <div style={{ color: accent.color }}>{widgetToneLabel(tone)}</div>
          <div>{formatNumberValue(min, decimals)} to {formatNumberValue(max, decimals)}</div>
        </div>
      </div>

      <div className="relative mt-4 h-5 overflow-hidden rounded-full border border-[var(--border)] bg-[var(--surface-alt)]/78">
        {min < 0 && max > 0 ? (
          <div
            className="absolute inset-y-0 w-px bg-[var(--border-strong)]/80"
            style={{ left: `${zeroPosition}%` }}
          />
        ) : null}
        <div
          className="absolute inset-y-0 rounded-full"
          style={{
            left: `${fillStart}%`,
            width: `${fillWidth}%`,
            background: `linear-gradient(90deg, ${accent.color} 0%, ${accent.soft} 100%)`,
          }}
        />
      </div>
    </div>
  )
}

function GraphWidgetView({
  topic,
  value,
  min,
  max,
  decimals,
  history,
  tone,
}: {
  topic: TelemetryTopic | null
  value: number | null
  min: number
  max: number
  decimals: number
  history: WidgetHistoryPoint[]
  tone: WidgetStatusTone
}) {
  if (value === null) {
    return <TextWidgetView topic={topic} valueText={topic?.valueText ?? '--'} />
  }

  const accent = widgetToneAccent(tone)
  const path = buildSparklinePath(history, min, max, 540, 148)

  return (
    <div
      className="mt-5 rounded-[20px] border bg-[var(--surface)]/75 px-4 py-4"
      style={{ borderColor: accent.border }}
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Trend view</div>
          <div className="mt-2 font-mono text-[clamp(1.4rem,1.2rem+0.9vw,2.2rem)] leading-none tracking-[-0.04em] text-[var(--text)]">
            {formatNumberValue(value, decimals)}
          </div>
        </div>
        <div className="text-right text-[0.74rem] leading-6 text-[var(--text-muted)]">
          <div style={{ color: accent.color }}>{widgetToneLabel(tone)}</div>
          <div>{formatNumberValue(min, decimals)} to {formatNumberValue(max, decimals)}</div>
        </div>
      </div>

      <div className="mt-4 rounded-[18px] border border-[var(--border)] bg-[var(--surface-alt)]/76 px-3 py-3">
        <svg viewBox="0 0 540 148" className="h-[148px] w-full">
          <path d={path} fill="none" stroke={accent.color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 text-[0.74rem] leading-6 text-[var(--text-muted)]">
        <div>{topic?.valueText ?? '--'}</div>
        <div>{history.length > 1 ? `${Math.round((history.length * 0.9) / 10)}s window` : 'building history'}</div>
      </div>
    </div>
  )
}

function DisplaySettingsPanel({
  topic,
  widget,
  history,
  onUpdate,
}: {
  topic: TelemetryTopic | null
  widget: PinnedTopicWidget
  history: WidgetHistoryPoint[]
  onUpdate: (key: string, patch: Partial<PinnedTopicWidget>) => void
}) {
  const range = useMemo(() => resolveNumericRange(widget, topic, history), [widget, topic, history])
  const numericTopic = getNumericTopicValue(topic) !== null
  const resolvedDisplayMode = resolveDisplayMode(topic, widget.displayMode)

  const commitNumericField = (
    field: 'rangeMin' | 'rangeMax' | 'booleanThreshold' | 'warningMin' | 'warningMax' | 'criticalMin' | 'criticalMax',
    rawValue: string,
  ) => {
    const trimmed = rawValue.trim()
    if (!trimmed) {
      onUpdate(widget.key, { [field]: null })
      return
    }

    const parsed = Number(trimmed)
    if (Number.isFinite(parsed)) {
      onUpdate(widget.key, { [field]: parsed })
    }
  }

  return (
    <div className="mt-4 grid gap-3 rounded-[18px] border border-[var(--border)] bg-[var(--surface)]/75 px-3 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[0.64rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
          Widget display
        </div>
        <div className="text-[0.72rem] text-[var(--text-muted)]">
          Active mode: {displayModeLabel(resolvedDisplayMode)}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="grid gap-2">
          <span className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Display mode</span>
          <select
            value={widget.displayMode}
            onChange={(event) => onUpdate(widget.key, { displayMode: event.target.value as WidgetDisplayMode })}
            className="rounded-[16px] border border-[var(--border)] bg-[var(--surface-alt)]/84 px-3 py-3 text-[0.88rem] text-[var(--text)] outline-none transition-colors focus:border-[var(--primary)]"
          >
            {getDisplayModeOptions(topic).map((mode) => (
              <option key={mode} value={mode}>
                {displayModeLabel(mode)}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-2">
          <span className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Card size</span>
          <select
            value={widget.cardSize}
            onChange={(event) => onUpdate(widget.key, { cardSize: event.target.value as WidgetCardSize })}
            className="rounded-[16px] border border-[var(--border)] bg-[var(--surface-alt)]/84 px-3 py-3 text-[0.88rem] text-[var(--text)] outline-none transition-colors focus:border-[var(--primary)]"
          >
            {(['compact', 'standard', 'wide', 'tall', 'hero'] as WidgetCardSize[]).map((size) => (
              <option key={size} value={size}>
                {cardSizeLabel(size)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {numericTopic ? (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="grid gap-2">
              <span className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Min</span>
              <input
                key={`range-min-${widget.rangeMin ?? 'auto'}`}
                defaultValue={widget.rangeMin === null ? '' : String(widget.rangeMin)}
                onBlur={(event) => commitNumericField('rangeMin', event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    commitNumericField('rangeMin', event.currentTarget.value)
                  }
                }}
                placeholder={String(range.inferredMin)}
                className="rounded-[16px] border border-[var(--border)] bg-[var(--surface-alt)]/84 px-3 py-3 text-[0.88rem] text-[var(--text)] outline-none transition-colors focus:border-[var(--primary)]"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Max</span>
              <input
                key={`range-max-${widget.rangeMax ?? 'auto'}`}
                defaultValue={widget.rangeMax === null ? '' : String(widget.rangeMax)}
                onBlur={(event) => commitNumericField('rangeMax', event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    commitNumericField('rangeMax', event.currentTarget.value)
                  }
                }}
                placeholder={String(range.inferredMax)}
                className="rounded-[16px] border border-[var(--border)] bg-[var(--surface-alt)]/84 px-3 py-3 text-[0.88rem] text-[var(--text)] outline-none transition-colors focus:border-[var(--primary)]"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Decimals</span>
              <select
                value={String(widget.decimals)}
                onChange={(event) => onUpdate(widget.key, { decimals: clampDecimals(Number(event.target.value)) })}
                className="rounded-[16px] border border-[var(--border)] bg-[var(--surface-alt)]/84 px-3 py-3 text-[0.88rem] text-[var(--text)] outline-none transition-colors focus:border-[var(--primary)]"
              >
                {[0, 1, 2, 3, 4].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-[0.74rem] leading-6 text-[var(--text-muted)]">
              Leave the range blank to use ORION auto-inference. This is what lets a meter show 0 to 60, 60 to 100 or any other window you want.
            </div>
            <button
              type="button"
              onClick={() => onUpdate(widget.key, { rangeMin: null, rangeMax: null, decimals: inferDefaultDecimals(topic) })}
              className="rounded-full border border-[var(--border)] bg-[var(--surface-alt)]/78 px-3 py-2 text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-alt)]"
            >
              Auto range
            </button>
          </div>

          <div className="grid gap-3 rounded-[18px] border border-[var(--border)] bg-[var(--surface-alt)]/70 px-3 py-3">
            <div className="text-[0.64rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
              Boolean threshold
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Condition</span>
                <select
                  value={widget.booleanCondition}
                  onChange={(event) => onUpdate(widget.key, { booleanCondition: event.target.value as WidgetBooleanCondition })}
                  className="rounded-[16px] border border-[var(--border)] bg-[var(--surface)]/84 px-3 py-3 text-[0.88rem] text-[var(--text)] outline-none transition-colors focus:border-[var(--primary)]"
                >
                  <option value="gte">true when value is greater or equal</option>
                  <option value="lte">true when value is less or equal</option>
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Threshold</span>
                <input
                  key={`boolean-threshold-${widget.booleanThreshold ?? 'auto'}`}
                  defaultValue={widget.booleanThreshold === null ? '' : String(widget.booleanThreshold)}
                  onBlur={(event) => commitNumericField('booleanThreshold', event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      commitNumericField('booleanThreshold', event.currentTarget.value)
                    }
                  }}
                  placeholder={formatNumberValue(resolveBooleanThreshold(widget, range), widget.decimals)}
                  className="rounded-[16px] border border-[var(--border)] bg-[var(--surface)]/84 px-3 py-3 text-[0.88rem] text-[var(--text)] outline-none transition-colors focus:border-[var(--primary)]"
                />
              </label>
            </div>
            <div className="text-[0.74rem] leading-6 text-[var(--text-muted)]">
              This lets a numeric topic behave like a boolean lamp, for example showing `true` only when the value is above a chosen limit.
            </div>
          </div>

          <div className="grid gap-3 rounded-[18px] border border-[var(--border)] bg-[var(--surface-alt)]/70 px-3 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[0.64rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                Alert zones
              </div>
              <button
                type="button"
                onClick={() =>
                  onUpdate(widget.key, {
                    warningMin: null,
                    warningMax: null,
                    criticalMin: null,
                    criticalMax: null,
                  })
                }
                className="rounded-full border border-[var(--border)] bg-[var(--surface)]/82 px-3 py-1.5 text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)] transition-colors hover:bg-[var(--surface)]"
              >
                Clear alerts
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {[
                ['warningMin', 'Warning low', widget.warningMin],
                ['warningMax', 'Warning high', widget.warningMax],
                ['criticalMin', 'Critical low', widget.criticalMin],
                ['criticalMax', 'Critical high', widget.criticalMax],
              ].map(([field, label, value]) => (
                <label key={field} className="grid gap-2">
                  <span className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">{label}</span>
                  <input
                    key={`${field}-${value ?? 'auto'}`}
                    defaultValue={value === null ? '' : String(value)}
                    onBlur={(event) => commitNumericField(field as 'warningMin' | 'warningMax' | 'criticalMin' | 'criticalMax', event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        commitNumericField(field as 'warningMin' | 'warningMax' | 'criticalMin' | 'criticalMax', event.currentTarget.value)
                      }
                    }}
                    placeholder="off"
                    className="rounded-[16px] border border-[var(--border)] bg-[var(--surface)]/84 px-3 py-3 text-[0.88rem] text-[var(--text)] outline-none transition-colors focus:border-[var(--primary)]"
                  />
                </label>
              ))}
            </div>

            <div className="text-[0.74rem] leading-6 text-[var(--text-muted)]">
              Warning and critical zones recolor the gauge, bar and graph based on the live numeric value. Leave any side blank if you do not want that boundary checked.
            </div>
          </div>
        </>
      ) : (
        <div className="text-[0.74rem] leading-6 text-[var(--text-muted)]">
          This topic is not numeric, so ORION keeps the widget focused on text or boolean display modes.
        </div>
      )}
    </div>
  )
}

function PinnedTopicCard({
  widget,
  topic,
  history,
  onRemove,
  onUpdate,
}: {
  widget: PinnedTopicWidget
  topic: TelemetryTopic | null
  history: WidgetHistoryPoint[]
  onRemove: (key: string) => void
  onUpdate: (key: string, patch: Partial<PinnedTopicWidget>) => void
}) {
  const writableKind = getWritableKind(topic)
  const [draftValue, setDraftValue] = useState<string | boolean>(() => createDraftFromTopic(topic))
  const [isDirty, setIsDirty] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'applied' | 'error'>('idle')
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [previewValueText, setPreviewValueText] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const effectiveDraftValue = isDirty ? draftValue : createDraftFromTopic(topic)
  const resolvedPreviewValueText =
    previewValueText && previewValueText !== topic?.valueText ? previewValueText : null
  const numericValue = getNumericTopicValue(topic)
  const range = useMemo(() => resolveNumericRange(widget, topic, history), [widget, topic, history])
  const resolvedDisplayMode = resolveDisplayMode(topic, widget.displayMode)
  const booleanDisplayValue = resolveBooleanDisplayValue(topic, widget, range)
  const widgetTone = evaluateWidgetTone(numericValue, widget)
  const booleanThreshold = resolveBooleanThreshold(widget, range)

  const applyChange = async () => {
    if (!topic || !writableKind) {
      return
    }

    const payloadValue =
      writableKind === 'boolean'
        ? Boolean(effectiveDraftValue)
        : writableKind === 'number'
          ? Number(effectiveDraftValue)
          : typeof effectiveDraftValue === 'string'
            ? effectiveDraftValue
            : String(effectiveDraftValue)

    if (writableKind === 'number' && (typeof payloadValue !== 'number' || Number.isNaN(payloadValue))) {
      setSaveState('error')
      setStatusMessage('Type a valid number before applying the update.')
      return
    }

    setSaveState('saving')
    setStatusMessage('Publishing update to the robot.')

    try {
      const response = await writeTelemetryTopicValue(topic.key, writableKind, payloadValue)
      if (response.error || !response.topic) {
        setSaveState('error')
        setStatusMessage(response.error ?? 'Failed to update topic.')
        return
      }

      setSaveState('applied')
      setStatusMessage(response.message ?? 'Value updated.')
      setDraftValue(createDraftFromTopic(response.topic))
      setIsDirty(false)
      setPreviewValueText(response.topic.valueText)
    } catch {
      setSaveState('error')
      setStatusMessage('Bridge write failed before the update reached the robot.')
    }
  }

  const missing = topic === null
  const valueText = resolvedPreviewValueText ?? topic?.valueText ?? '--'
  const keySegments = widget.key.split('/')
  const fallbackLabel = keySegments[keySegments.length - 1] ?? widget.key
  const saveTone = saveState === 'applied' ? 'good' : saveState === 'error' ? 'critical' : saveState === 'saving' ? 'warning' : 'neutral'

  return (
    <div
      className={cn(
        'rounded-[22px] border border-[var(--border)] bg-[var(--surface-alt)]/84 px-4 py-4',
        cardSizeClass(widget.cardSize, resolvedDisplayMode),
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-[0.82rem] font-semibold tracking-[-0.02em] text-[var(--text)]">
              {topic?.label ?? fallbackLabel}
            </div>
            <div
              className={cn(
                'rounded-full border px-2.5 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.14em]',
                topic
                  ? scopeChipClass(topic.scope)
                  : 'border-[var(--warning)]/24 bg-[color-mix(in_srgb,var(--warning)_12%,transparent)] text-[var(--text)]',
              )}
            >
              {topic ? scopeLabel(topic.scope) : 'Missing'}
            </div>
            {writableKind ? <StatusBadge tone="info" label="tune" /> : null}
            <StatusBadge tone="neutral" label={displayModeLabel(resolvedDisplayMode)} />
            {numericValue !== null ? <StatusBadge tone={widgetToneToBadgeTone(widgetTone)} label={widgetToneLabel(widgetTone)} /> : null}
          </div>
          <div className="mt-1 text-[0.74rem] leading-6 text-[var(--text-muted)]">
            {topic ? `${topic.valueKind}${topic.persistent ? ' / persistent' : ''}` : 'Current robot is not publishing this topic.'}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSettingsOpen((current) => !current)}
            className="rounded-full border border-[var(--border)] bg-[var(--surface)]/82 px-3 py-2 text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)] transition-colors hover:bg-[var(--surface)]"
          >
            {settingsOpen ? 'Hide setup' : 'Display setup'}
          </button>
          <button
            type="button"
            onClick={() => onRemove(widget.key)}
            className="rounded-full border border-[var(--border)] bg-[var(--surface)]/82 px-3 py-2 text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)] transition-colors hover:bg-[var(--surface)]"
          >
            Remove
          </button>
        </div>
      </div>

      {resolvedDisplayMode === 'boolean' ? (
        <BooleanWidgetView
          topic={topic}
          value={booleanDisplayValue}
          label={
            topic?.valueKind === 'number'
              ? widget.booleanCondition === 'lte'
                ? `true at or below ${formatNumberValue(booleanThreshold, widget.decimals)}`
                : `true at or above ${formatNumberValue(booleanThreshold, widget.decimals)}`
              : 'live state'
          }
          tone={widgetTone}
        />
      ) : resolvedDisplayMode === 'gauge' ? (
        <GaugeWidgetView
          topic={topic}
          value={numericValue}
          min={range.min}
          max={range.max}
          decimals={widget.decimals}
          tone={widgetTone}
        />
      ) : resolvedDisplayMode === 'bar' ? (
        <BarWidgetView
          topic={topic}
          value={numericValue}
          min={range.min}
          max={range.max}
          decimals={widget.decimals}
          tone={widgetTone}
        />
      ) : resolvedDisplayMode === 'graph' ? (
        <GraphWidgetView
          topic={topic}
          value={numericValue}
          min={range.min}
          max={range.max}
          decimals={widget.decimals}
          history={history}
          tone={widgetTone}
        />
      ) : (
        <TextWidgetView
          topic={topic}
          valueText={numericValue !== null ? formatWidgetValue(topic, widget.decimals) : valueText}
        />
      )}

      {settingsOpen ? (
        <DisplaySettingsPanel topic={topic} widget={widget} history={history} onUpdate={onUpdate} />
      ) : null}

      <div className="mt-4 rounded-[18px] border border-[var(--border)] bg-[var(--surface)]/75 px-3 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[0.64rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
            Topic key
          </div>
          {numericValue !== null ? (
            <div className="text-[0.72rem] leading-6 text-[var(--text-muted)]">
              window {formatNumberValue(range.min, widget.decimals)} to {formatNumberValue(range.max, widget.decimals)}
            </div>
          ) : null}
        </div>
        <div className="mt-1 break-all font-mono text-[0.72rem] leading-6 text-[var(--text)]">{widget.key}</div>
      </div>

      {writableKind ? (
        <div className="mt-4 grid gap-3 rounded-[18px] border border-[var(--border)] bg-[var(--surface)]/75 px-3 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[0.64rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
              Live tuning
            </div>
            <StatusBadge tone={saveTone} label={saveState === 'idle' ? 'ready' : saveState} />
          </div>

          {writableKind === 'boolean' ? (
            <select
              value={String(Boolean(effectiveDraftValue))}
              onChange={(event) => {
                setDraftValue(event.target.value === 'true')
                setIsDirty(true)
                setSaveState('idle')
                setStatusMessage(null)
              }}
              className="rounded-[16px] border border-[var(--border)] bg-[var(--surface-alt)]/84 px-3 py-3 text-[0.88rem] text-[var(--text)] outline-none transition-colors focus:border-[var(--primary)]"
            >
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          ) : (
            <input
              value={String(effectiveDraftValue)}
              onChange={(event) => {
                setDraftValue(event.target.value)
                setIsDirty(true)
                setSaveState('idle')
                setStatusMessage(null)
              }}
              placeholder={writableKind === 'number' ? 'Type a numeric value' : 'Type a new value'}
              className="rounded-[16px] border border-[var(--border)] bg-[var(--surface-alt)]/84 px-3 py-3 text-[0.88rem] text-[var(--text)] outline-none transition-colors focus:border-[var(--primary)]"
            />
          )}

          <div className="flex items-center justify-between gap-3">
            <div className="text-[0.74rem] leading-5 text-[var(--text-muted)]">
              Config or persistent scalar topics can be tuned from ORION while you keep the widget in text, graph, bar or gauge mode.
            </div>
            <button
              type="button"
              onClick={() => {
                void applyChange()
              }}
              disabled={saveState === 'saving' || missing || !isDirty}
              className={cn(
                'rounded-full border px-3 py-2 text-[0.72rem] font-semibold uppercase tracking-[0.14em] transition-colors',
                saveState === 'saving' || missing || !isDirty
                  ? 'cursor-default border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)]'
                  : 'border-[var(--primary)]/28 bg-[var(--primary-soft)] text-[var(--text)] hover:bg-[var(--primary-soft)]',
              )}
            >
              {saveState === 'saving' ? 'Applying' : 'Apply'}
            </button>
          </div>

          {statusMessage ? <div className="text-[0.74rem] leading-5 text-[var(--text-muted)]">{statusMessage}</div> : null}
        </div>
      ) : null}
    </div>
  )
}

export function CustomTelemetryWorkspace() {
  const [historyByTopic, setHistoryByTopic] = useState<Record<string, WidgetHistoryPoint[]>>({})
  const [searchQuery, setSearchQuery] = useState('')
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('all')
  const [pinnedWidgets, setPinnedWidgets] = useState<PinnedTopicWidget[]>(() => loadPinnedWidgets())
  const pinnedWidgetsRef = useRef(pinnedWidgets)
  const deferredQuery = useDeferredValue(searchQuery.trim().toLowerCase())

  const catalog = useTelemetryCatalog((incoming) => {
    setHistoryByTopic((current) => {
      const activeWidgets = pinnedWidgetsRef.current
      const activeKeys = new Set(activeWidgets.map((widget) => widget.key))
      const incomingTopicMap = new Map(incoming.topics.map((topic) => [topic.key, topic]))
      let changed = false
      const next: Record<string, WidgetHistoryPoint[]> = {}

      for (const widget of activeWidgets) {
        const previousHistory = current[widget.key] ?? []
        const topic = incomingTopicMap.get(widget.key) ?? null
        const value = getNumericTopicValue(topic)
        if (value === null) {
          if (previousHistory.length) {
            next[widget.key] = previousHistory
          }
          continue
        }

        const lastPoint = previousHistory[previousHistory.length - 1]
        if (lastPoint && lastPoint.timestamp === incoming.timestamp) {
          next[widget.key] = previousHistory
          continue
        }

        next[widget.key] = [...previousHistory, { timestamp: incoming.timestamp, value }].slice(-HISTORY_LIMIT)
        changed = true
      }

      if (Object.keys(current).some((key) => !activeKeys.has(key))) {
        changed = true
      }

      return changed ? next : current
    })
  })

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pinnedWidgets))
  }, [pinnedWidgets])

  useEffect(() => {
    pinnedWidgetsRef.current = pinnedWidgets
  }, [pinnedWidgets])

  const topicMap = useMemo(() => {
    return new Map(catalog.topics.map((topic) => [topic.key, topic]))
  }, [catalog.topics])

  const pinnedKeySet = useMemo(() => new Set(pinnedWidgets.map((widget) => widget.key)), [pinnedWidgets])
  const editableCount = useMemo(() => catalog.topics.filter((topic) => topic.isWritable).length, [catalog.topics])

  const filteredTopics = useMemo(() => {
    return catalog.topics.filter((topic) => {
      if (scopeFilter !== 'all' && topic.scope !== scopeFilter) {
        return false
      }

      return isSearchMatch(topic, deferredQuery)
    })
  }, [catalog.topics, deferredQuery, scopeFilter])

  const visibleTopics = filteredTopics.slice(0, RESULT_LIMIT)

  const pinnedTopics = useMemo(() => {
    return pinnedWidgets.map((widget) => ({
      widget,
      topic: topicMap.get(widget.key) ?? null,
      history: historyByTopic[widget.key] ?? [],
    }))
  }, [historyByTopic, pinnedWidgets, topicMap])

  const addPinnedTopic = (topic: TelemetryTopic) => {
    startTransition(() => {
      setPinnedWidgets((current) => {
        if (current.some((widget) => widget.key === topic.key)) {
          return current
        }

        return [...current, createDefaultPinnedWidget(topic.key, topic)]
      })
    })
  }

  const removePinnedTopic = (key: string) => {
    startTransition(() => {
      setPinnedWidgets((current) => current.filter((widget) => widget.key !== key))
      setHistoryByTopic((current) => {
        if (!current[key]) {
          return current
        }

        const next = { ...current }
        delete next[key]
        return next
      })
    })
  }

  const updatePinnedTopic = (key: string, patch: Partial<PinnedTopicWidget>) => {
    setPinnedWidgets((current) =>
      current.map((widget) =>
        widget.key === key
          ? {
              ...widget,
              ...patch,
              decimals:
                typeof patch.decimals === 'number'
                  ? clampDecimals(patch.decimals)
                  : widget.decimals,
            }
          : widget,
      ),
    )
  }

  const clearPinnedTopics = () => {
    startTransition(() => {
      setPinnedWidgets([])
      setHistoryByTopic({})
    })
  }

  return (
    <div className="grid gap-3">
      <div className="grid gap-3 xl:grid-cols-5">
        <SummaryTile
          label="Robot Link"
          value={catalog.stats.online ? 'Live' : 'Standby'}
          detail={catalog.bridgeStatus?.message ?? 'Bridge status unavailable.'}
          tone={catalog.stats.online ? 'good' : 'warning'}
        />
        <SummaryTile
          label="Published Topics"
          value={String(catalog.stats.totalTopics)}
          detail={`${catalog.stats.groupCount} groups detected across SmartDashboard`}
          tone="info"
        />
        <SummaryTile
          label="Editable Topics"
          value={String(editableCount)}
          detail="Config or persistent scalar entries available for live tuning"
          tone={editableCount ? 'good' : 'neutral'}
        />
        <SummaryTile
          label="Pinned Cards"
          value={String(pinnedWidgets.length)}
          detail="Each card can switch mode, resize itself and define its own alert zones"
          tone={pinnedWidgets.length ? 'good' : 'neutral'}
        />
        <SummaryTile
          label="Catalog Clock"
          value={formatClock(catalog.timestamp)}
          detail={catalog.stats.team ? `Team ${catalog.stats.team}` : 'Waiting for team discovery'}
          tone="neutral"
        />
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(340px,0.96fr)_minmax(0,1.34fr)]">
        <DashboardCard title="Telemetry Catalog" subtitle="discover topics exposed by the current robot" accent="info">
          <div className="grid h-full min-h-0 gap-3">
            <label className="grid gap-2">
              <span className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                Search by key, group or value
              </span>
              <input
                value={searchQuery}
                onChange={(event) => {
                  const nextValue = event.target.value
                  startTransition(() => {
                    setSearchQuery(nextValue)
                  })
                }}
                placeholder="Config/Reactive/Turn Gain"
                className="rounded-[18px] border border-[var(--border)] bg-[var(--surface-alt)]/84 px-4 py-3 text-[0.92rem] text-[var(--text)] outline-none transition-colors placeholder:text-[var(--text-muted)] focus:border-[var(--primary)]"
              />
            </label>

            <div className="flex flex-wrap gap-2">
              {(['all', 'telemetry', 'debug', 'config', 'auto-mode', 'other'] as ScopeFilter[]).map((scope) => {
                const active = scope === scopeFilter
                const label = scope === 'all' ? 'All scopes' : scopeLabel(scope)
                const count = scope === 'all' ? catalog.stats.totalTopics : catalog.stats.scopeCounts[scope]

                return (
                  <button
                    key={scope}
                    type="button"
                    onClick={() => setScopeFilter(scope)}
                    className={cn(
                      'rounded-full border px-3 py-2 text-[0.72rem] font-semibold uppercase tracking-[0.14em] transition-colors',
                      active
                        ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--text)]'
                        : 'border-[var(--border)] bg-[var(--surface-alt)]/78 text-[var(--text-muted)] hover:bg-[var(--surface-alt)]',
                    )}
                  >
                    {label} / {count}
                  </button>
                )
              })}
            </div>

            <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface-alt)]/76 px-4 py-3 text-[0.82rem] leading-6 text-[var(--text-muted)]">
              Pin any topic to the board, then decide how it should look. ORION now lets each card behave like a text readout, boolean lamp, trend graph, progress bar or gauge with a custom measurement window, threshold logic and alert coloring.
            </div>

            <div className="flex items-center justify-between gap-3 text-[0.76rem] text-[var(--text-muted)]">
              <div>Showing {visibleTopics.length} of {filteredTopics.length} matching topics</div>
              <div className="font-mono">{catalog.stats.online ? 'live feed' : 'cached feed'}</div>
            </div>

            <div className="min-h-0 space-y-2 overflow-auto pr-1">
              {visibleTopics.length ? (
                visibleTopics.map((topic) => (
                  <CatalogTopicRow
                    key={topic.key}
                    topic={topic}
                    pinned={pinnedKeySet.has(topic.key)}
                    onAdd={addPinnedTopic}
                  />
                ))
              ) : (
                <div className="rounded-[20px] border border-dashed border-[var(--border)] bg-[var(--surface-alt)]/76 px-4 py-6 text-[0.84rem] leading-6 text-[var(--text-muted)]">
                  No topics matched the current filter. Try another scope or a broader search term.
                </div>
              )}
            </div>

            {filteredTopics.length > visibleTopics.length ? (
              <div className="text-[0.74rem] leading-6 text-[var(--text-muted)]">
                Narrow the search to inspect more than the first {RESULT_LIMIT} matches.
              </div>
            ) : null}
          </div>
        </DashboardCard>

        <DashboardCard
          title="Custom Board"
          subtitle="live cards assembled from the topics you pin"
          accent="accent"
          headerSlot={
            pinnedWidgets.length ? (
              <button
                type="button"
                onClick={clearPinnedTopics}
                className="rounded-full border border-[var(--border)] bg-[var(--surface-alt)]/78 px-3 py-2 text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-alt)]"
              >
                Clear board
              </button>
            ) : null
          }
        >
          {pinnedTopics.length ? (
            <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {pinnedTopics.map(({ widget, topic, history }) => (
                <PinnedTopicCard
                  key={widget.key}
                  widget={widget}
                  topic={topic}
                  history={history}
                  onRemove={removePinnedTopic}
                  onUpdate={updatePinnedTopic}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-[22px] border border-dashed border-[var(--border)] bg-[var(--surface-alt)]/76 px-5 py-8 text-[0.86rem] leading-7 text-[var(--text-muted)]">
              Pick any topic from the catalog and pin it here. The board is saved locally, so each operator can keep a personal live workspace, tune writable values, resize cards and decide whether each telemetry signal reads better as text, graph, boolean lamp, bar or gauge.
            </div>
          )}
        </DashboardCard>
      </div>
    </div>
  )
}
