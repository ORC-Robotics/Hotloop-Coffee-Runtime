import { useMemo, useState } from 'react'
import { resolveActiveCameraFeeds, type ResolvedCameraFeed } from '../../../lib/cameraFeeds'
import type { DiscoveredCameraFeed } from '../../../types/telemetry'
import { useDashboardPreferences } from '../../../preferences/useDashboardPreferences'
import { CameraFeedMedia, type CameraFeedResourceStatus } from '../CameraFeedMedia'
import { StatusBadge } from '../StatusBadge'

function hostLabel(url: string) {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

function CameraWidgetEmptyState({
  title,
  message,
}: {
  title: string
  message: string
}) {
  return (
    <div className="flex h-full min-h-0 items-center justify-center rounded-[18px] border border-dashed border-[var(--border)] bg-[var(--surface)]/52 px-4 py-5 text-center">
      <div>
        <div className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
          {title}
        </div>
        <div className="mt-2 text-[0.82rem] leading-6 text-[var(--text-muted)]">{message}</div>
      </div>
    </div>
  )
}

function resolveSelectedFeed(
  feeds: ResolvedCameraFeed[],
  selectedFeedId: string | null,
) {
  if (!feeds.length) {
    return null
  }

  if (!selectedFeedId) {
    return feeds[0] ?? null
  }

  return feeds.find((feed) => feed.id === selectedFeedId) ?? null
}

export function HomeWorkspaceCameraStreamWidget({
  selectedFeedId,
  discoveredFeeds,
}: {
  selectedFeedId: string | null
  discoveredFeeds: DiscoveredCameraFeed[]
}) {
  const { preferences } = useDashboardPreferences()
  const [status, setStatus] = useState<CameraFeedResourceStatus>('loading')
  const resolvedFeeds = useMemo(
    () => resolveActiveCameraFeeds(preferences.cameraFeeds, discoveredFeeds),
    [discoveredFeeds, preferences.cameraFeeds],
  )
  const feed = useMemo(
    () => resolveSelectedFeed(resolvedFeeds, selectedFeedId),
    [resolvedFeeds, selectedFeedId],
  )

  if (!resolvedFeeds.length) {
    return (
      <CameraWidgetEmptyState
        title="No camera feed"
        message="No active feed is available yet. Enable a simulated camera or add a manual stream in Settings."
      />
    )
  }

  if (!feed) {
    return (
      <CameraWidgetEmptyState
        title="Feed unavailable"
        message="The selected camera feed is not present in the current live catalog."
      />
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
            {feed.label}
          </div>
          <div className="truncate text-[0.82rem] text-[var(--text)]">{hostLabel(feed.url)}</div>
        </div>

        <div className="flex flex-wrap gap-2">
          <StatusBadge
            tone={status === 'live' ? 'good' : status === 'loading' ? 'warning' : 'critical'}
            label={status === 'live' ? 'live' : status === 'loading' ? 'connecting' : 'error'}
          />
          <StatusBadge tone={feed.source === 'auto' ? 'info' : 'neutral'} label={feed.source === 'auto' ? 'auto' : 'manual'} />
          <StatusBadge tone="neutral" label={feed.kind} />
        </div>
      </div>

      <CameraFeedMedia
        feed={feed}
        className="min-h-0 flex-1"
        mediaClassName="h-full min-h-[168px]"
        showGradient
        onStatusChange={setStatus}
      />
    </div>
  )
}
