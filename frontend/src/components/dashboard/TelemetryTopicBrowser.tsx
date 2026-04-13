/* eslint-disable react-refresh/only-export-components */

import { useDeferredValue, useMemo } from 'react'
import { cn } from '../../lib/cn'
import type { TelemetryTopic, TelemetryTopicScope } from '../../types/telemetry'
import { StatusBadge } from './StatusBadge'

export type TelemetryTopicScopeFilter = 'all' | TelemetryTopicScope

export const TELEMETRY_TOPIC_SCOPE_FILTERS: TelemetryTopicScopeFilter[] = [
  'all',
  'telemetry',
  'debug',
  'config',
  'auto-mode',
  'other',
]

export function scopeLabel(scope: TelemetryTopicScope) {
  if (scope === 'telemetry') return 'Telemetry'
  if (scope === 'debug') return 'Debug'
  if (scope === 'config') return 'Config'
  if (scope === 'auto-mode') return 'Auto Mode'
  return 'Other'
}

export function scopeChipClass(scope: TelemetryTopicScope) {
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

export function isTelemetryTopicSearchMatch(topic: TelemetryTopic, query: string) {
  if (!query) {
    return true
  }

  const searchable = `${topic.key} ${topic.label} ${topic.groupPath} ${topic.valueText}`.toLowerCase()
  return searchable.includes(query)
}

interface TelemetryTopicBrowserAction {
  disabled?: boolean
  label: string
  onClick: () => void
}

interface TelemetryTopicBrowserProps {
  emptyMessage: string
  getAction: (topic: TelemetryTopic) => TelemetryTopicBrowserAction
  listClassName?: string
  maxResults?: number
  scopeFilter: TelemetryTopicScopeFilter
  onScopeFilterChange: (scope: TelemetryTopicScopeFilter) => void
  onSearchQueryChange: (value: string) => void
  searchPlaceholder?: string
  searchQuery: string
  topics: TelemetryTopic[]
}

function TelemetryTopicRow({
  topic,
  action,
}: {
  topic: TelemetryTopic
  action: TelemetryTopicBrowserAction
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

          <div className="mt-1 break-all font-mono text-[0.72rem] leading-6 text-[var(--text-muted)]">{topic.key}</div>

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
            onClick={action.onClick}
            disabled={action.disabled}
            className={cn(
              'rounded-full border px-3 py-2 text-[0.72rem] font-semibold uppercase tracking-[0.14em] transition-colors',
              action.disabled
                ? 'cursor-default border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)]'
                : 'border-[var(--accent)]/28 bg-[var(--accent-soft)]/78 text-[var(--text)] hover:bg-[var(--accent-soft)]',
            )}
          >
            {action.label}
          </button>
        </div>
      </div>
    </div>
  )
}

export function TelemetryTopicBrowser({
  emptyMessage,
  getAction,
  listClassName,
  maxResults = 80,
  scopeFilter,
  onScopeFilterChange,
  onSearchQueryChange,
  searchPlaceholder = 'Config/Reactive/Turn Gain',
  searchQuery,
  topics,
}: TelemetryTopicBrowserProps) {
  const deferredQuery = useDeferredValue(searchQuery.trim().toLowerCase())

  const filteredTopics = useMemo(() => {
    return topics.filter((topic) => {
      if (scopeFilter !== 'all' && topic.scope !== scopeFilter) {
        return false
      }

      return isTelemetryTopicSearchMatch(topic, deferredQuery)
    })
  }, [deferredQuery, scopeFilter, topics])

  const visibleTopics = filteredTopics.slice(0, maxResults)

  const scopeCounts = useMemo(() => {
    return {
      telemetry: topics.filter((topic) => topic.scope === 'telemetry').length,
      debug: topics.filter((topic) => topic.scope === 'debug').length,
      config: topics.filter((topic) => topic.scope === 'config').length,
      'auto-mode': topics.filter((topic) => topic.scope === 'auto-mode').length,
      other: topics.filter((topic) => topic.scope === 'other').length,
    } satisfies Record<TelemetryTopicScope, number>
  }, [topics])

  return (
    <div className="grid h-full min-h-0 gap-3">
      <label className="grid gap-2">
        <span className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
          Search by key, group or value
        </span>
        <input
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
          placeholder={searchPlaceholder}
          className="rounded-[18px] border border-[var(--border)] bg-[var(--surface-alt)]/84 px-4 py-3 text-[0.92rem] text-[var(--text)] outline-none transition-colors placeholder:text-[var(--text-muted)] focus:border-[var(--primary)]"
        />
      </label>

      <div className="flex flex-wrap gap-2">
        {TELEMETRY_TOPIC_SCOPE_FILTERS.map((scope) => {
          const active = scope === scopeFilter
          const label = scope === 'all' ? 'All scopes' : scopeLabel(scope)
          const count = scope === 'all' ? topics.length : scopeCounts[scope]

          return (
            <button
              key={scope}
              type="button"
              onClick={() => onScopeFilterChange(scope)}
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

      <div className="flex items-center justify-between gap-3 text-[0.76rem] text-[var(--text-muted)]">
        <div>
          Showing {visibleTopics.length} of {filteredTopics.length} matching topics
        </div>
        <div className="font-mono">{topics.length} topics</div>
      </div>

      <div className={cn('min-h-0 space-y-2 overflow-auto pr-1', listClassName)}>
        {visibleTopics.length ? (
          visibleTopics.map((topic) => <TelemetryTopicRow key={topic.key} topic={topic} action={getAction(topic)} />)
        ) : (
          <div className="rounded-[20px] border border-dashed border-[var(--border)] bg-[var(--surface-alt)]/76 px-4 py-6 text-[0.84rem] leading-6 text-[var(--text-muted)]">
            {emptyMessage}
          </div>
        )}
      </div>

      {filteredTopics.length > visibleTopics.length ? (
        <div className="text-[0.74rem] leading-6 text-[var(--text-muted)]">
          Narrow the search to inspect more than the first {maxResults} matches.
        </div>
      ) : null}
    </div>
  )
}
