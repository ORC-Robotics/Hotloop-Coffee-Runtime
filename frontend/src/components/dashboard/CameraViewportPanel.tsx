import { useMemo, useState } from 'react'
import { useDashboardPreferences } from '../../preferences/useDashboardPreferences'
import type { CameraFeedConfig } from '../../preferences/dashboardPreferencesStore'
import type { ResolvedCameraFeed } from '../../lib/cameraFeeds'
import { DashboardCard } from './DashboardCard'
import { CameraFeedMedia, type CameraFeedResourceStatus } from './CameraFeedMedia'
import { StatusBadge } from './StatusBadge'

function hostLabel(url: string) {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

function toResolvedManualFeed(feed: CameraFeedConfig): ResolvedCameraFeed {
  return {
    ...feed,
    source: 'manual',
  }
}

function CameraTile({ feed, compact = false }: { feed: ResolvedCameraFeed; compact?: boolean }) {
  const [status, setStatus] = useState<CameraFeedResourceStatus>('loading')

  return (
    <div className="grid gap-2 rounded-[20px] border border-[var(--border)] bg-[var(--surface-alt)]/82 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[0.74rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
            {feed.label}
          </div>
          <div className="truncate text-[0.8rem] text-[var(--text)]">{hostLabel(feed.url)}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge
            tone={status === 'live' ? 'good' : status === 'loading' ? 'warning' : 'critical'}
            label={status === 'live' ? 'live' : status === 'loading' ? 'connecting' : 'unavailable'}
          />
          <StatusBadge tone={feed.source === 'auto' ? 'info' : 'neutral'} label={feed.source === 'auto' ? 'auto' : 'manual'} />
          <StatusBadge tone="neutral" label={feed.kind} />
        </div>
      </div>

      <CameraFeedMedia
        feed={feed}
        mediaClassName={compact ? 'h-[220px]' : 'h-[300px]'}
        showGradient
        onStatusChange={setStatus}
      />
    </div>
  )
}

export function CameraViewportPanel({
  feeds,
  title = 'Camera Viewports',
  subtitle = 'live robot vision feeds',
  compact = false,
}: {
  feeds?: ResolvedCameraFeed[]
  title?: string
  subtitle?: string
  compact?: boolean
}) {
  const { activeCameraFeeds } = useDashboardPreferences()
  const resolvedFeeds = useMemo(
    () => feeds ?? activeCameraFeeds.map((feed) => toResolvedManualFeed(feed)),
    [activeCameraFeeds, feeds],
  )

  return (
    <DashboardCard
      title={title}
      subtitle={subtitle}
      accent="accent"
      className="min-h-[0]"
      headerSlot={
        <StatusBadge
          tone={resolvedFeeds.length ? 'good' : 'warning'}
          label={resolvedFeeds.length ? `${resolvedFeeds.length} live slot${resolvedFeeds.length > 1 ? 's' : ''}` : 'no feeds'}
        />
      }
    >
      {resolvedFeeds.length ? (
        <div className={`grid gap-3 ${resolvedFeeds.length > 1 ? 'xl:grid-cols-2' : ''}`}>
          {resolvedFeeds.map((feed) => (
            <CameraTile key={feed.id} feed={feed} compact={compact} />
          ))}
        </div>
      ) : (
        <div className="rounded-[20px] border border-dashed border-[var(--border)] bg-[var(--surface-alt)]/76 px-4 py-6 text-[0.86rem] leading-7 text-[var(--text-muted)]">
          O ORION agora tenta localizar streams publicados em `CameraPublisher` automaticamente. Se o robo ainda nao anunciar nenhuma live, voce pode manter o fallback manual em Settings usando uma URL MJPEG, snapshot ou video.
        </div>
      )}
    </DashboardCard>
  )
}
