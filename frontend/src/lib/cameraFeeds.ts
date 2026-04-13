import type { CameraFeedConfig } from '../preferences/dashboardPreferencesStore'
import type { DiscoveredCameraFeed } from '../types/telemetry'

const AUTO_FEED_REFRESH_MS = 900

export interface ResolvedCameraFeed extends CameraFeedConfig {
  source: 'manual' | 'auto'
  connected?: boolean
  description?: string | null
  streamSource?: string | null
}

function canonicalCameraUrl(url: string) {
  const trimmed = url.trim()
  if (!trimmed) {
    return ''
  }

  try {
    const parsed = new URL(trimmed)
    const pathname = parsed.pathname.replace(/\/+$/, '') || '/'
    return `${parsed.protocol.toLowerCase()}//${parsed.host.toLowerCase()}${pathname}${parsed.search}`
  } catch {
    return trimmed.toLowerCase()
  }
}

export function resolveActiveCameraFeeds(
  manualFeeds: CameraFeedConfig[],
  discoveredFeeds: DiscoveredCameraFeed[],
): ResolvedCameraFeed[] {
  const resolved: ResolvedCameraFeed[] = []
  const seenUrls = new Set<string>()

  for (const feed of manualFeeds) {
    if (!feed.enabled || !feed.url.trim()) {
      continue
    }

    seenUrls.add(canonicalCameraUrl(feed.url))
    resolved.push({
      ...feed,
      source: 'manual',
    })
  }

  for (const feed of discoveredFeeds) {
    if (!feed.url.trim()) {
      continue
    }

    const urlKey = canonicalCameraUrl(feed.url)
    if (!urlKey || seenUrls.has(urlKey)) {
      continue
    }

    seenUrls.add(urlKey)
    resolved.push({
      id: `auto-${feed.id}`,
      label: feed.label,
      url: feed.url,
      kind: feed.kind,
      enabled: true,
      refreshMs: AUTO_FEED_REFRESH_MS,
      source: 'auto',
      connected: feed.connected,
      description: feed.description,
      streamSource: feed.source,
    })
  }

  return resolved
}
