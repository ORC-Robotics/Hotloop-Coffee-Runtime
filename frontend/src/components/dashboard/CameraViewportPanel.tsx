import { useEffect, useMemo, useState } from 'react'
import { useDashboardPreferences } from '../../preferences/useDashboardPreferences'
import type { CameraFeedConfig } from '../../preferences/dashboardPreferencesStore'
import { DashboardCard } from './DashboardCard'
import { StatusBadge } from './StatusBadge'

function hostLabel(url: string) {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

function useSnapshotUrl(feed: CameraFeedConfig) {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (feed.kind !== 'snapshot' || !feed.enabled || !feed.url.trim()) {
      return
    }

    const interval = window.setInterval(() => {
      setTick((current) => current + 1)
    }, Math.max(250, feed.refreshMs))

    return () => {
      window.clearInterval(interval)
    }
  }, [feed.enabled, feed.kind, feed.refreshMs, feed.url])

  return useMemo(() => {
    if (feed.kind !== 'snapshot' || !feed.url.trim()) {
      return feed.url
    }

    const separator = feed.url.includes('?') ? '&' : '?'
    return `${feed.url}${separator}_orion=${tick}`
  }, [feed.kind, feed.url, tick])
}

function CameraTile({ feed, compact = false }: { feed: CameraFeedConfig; compact?: boolean }) {
  const [resourceState, setResourceState] = useState<{
    key: string
    status: 'loading' | 'live' | 'error'
  }>({
    key: '',
    status: 'loading',
  })
  const src = useSnapshotUrl(feed)
  const resourceKey = `${feed.kind}:${src}`
  const status =
    !feed.url.trim()
      ? 'error'
      : resourceState.key === resourceKey
        ? resourceState.status
        : 'loading'

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
          <StatusBadge tone="neutral" label={feed.kind} />
        </div>
      </div>

      <div className="relative overflow-hidden rounded-[18px] border border-[var(--border)] bg-[var(--background-subtle)]">
        {feed.url.trim() ? (
          feed.kind === 'video' ? (
            <video
              src={src}
              autoPlay
              muted
              playsInline
              className={`w-full object-cover ${compact ? 'h-[220px]' : 'h-[300px]'}`}
              onCanPlay={() => setResourceState({ key: resourceKey, status: 'live' })}
              onError={() => setResourceState({ key: resourceKey, status: 'error' })}
            />
          ) : (
            <img
              src={src}
              alt={feed.label}
              className={`w-full object-cover ${compact ? 'h-[220px]' : 'h-[300px]'}`}
              onLoad={() => setResourceState({ key: resourceKey, status: 'live' })}
              onError={() => setResourceState({ key: resourceKey, status: 'error' })}
            />
          )
        ) : (
          <div className={`flex items-center justify-center text-[0.84rem] text-[var(--text-muted)] ${compact ? 'h-[220px]' : 'h-[300px]'}`}>
            Configure a stream URL in Settings.
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[var(--overlay)] to-transparent" />
      </div>
    </div>
  )
}

export function CameraViewportPanel({
  title = 'Camera Viewports',
  subtitle = 'live robot vision feeds',
  compact = false,
}: {
  title?: string
  subtitle?: string
  compact?: boolean
}) {
  const { activeCameraFeeds } = useDashboardPreferences()

  return (
    <DashboardCard
      title={title}
      subtitle={subtitle}
      accent="accent"
      className="min-h-[0]"
      headerSlot={
        <StatusBadge
          tone={activeCameraFeeds.length ? 'good' : 'warning'}
          label={activeCameraFeeds.length ? `${activeCameraFeeds.length} live slot${activeCameraFeeds.length > 1 ? 's' : ''}` : 'no feeds'}
        />
      }
    >
      {activeCameraFeeds.length ? (
        <div className={`grid gap-3 ${activeCameraFeeds.length > 1 ? 'xl:grid-cols-2' : ''}`}>
          {activeCameraFeeds.map((feed) => (
            <CameraTile key={feed.id} feed={feed} compact={compact} />
          ))}
        </div>
      ) : (
        <div className="rounded-[20px] border border-dashed border-[var(--border)] bg-[var(--surface-alt)]/76 px-4 py-6 text-[0.86rem] leading-7 text-[var(--text-muted)]">
          Atlas ainda nao publica um stream de camera por padrao, mas o ORION agora aceita viewport por URL. Quando voce tiver um feed MJPEG, snapshot ou video, basta configurar em Settings para ele aparecer aqui.
        </div>
      )}
    </DashboardCard>
  )
}
