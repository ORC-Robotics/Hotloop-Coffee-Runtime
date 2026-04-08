import {
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react'
import {
  DashboardPreferencesContext,
  type CameraFeedConfig,
  type DashboardLayoutSettings,
  type DashboardPreferencesState,
  type LayoutPresetDefinition,
  type LayoutPresetId,
  type UiScaleId,
} from './dashboardPreferencesStore'

const STORAGE_KEY = 'orion.dashboard-preferences.v1'

const layoutPresets: LayoutPresetDefinition[] = [
  {
    id: 'factory',
    label: 'Factory',
    description: 'Balanced layout for everyday telemetry monitoring.',
    layout: {
      uiScale: 'standard',
      overviewLayout: 'balanced',
      diagnosticsLayout: 'split',
      systemsLayout: 'wide',
      showCameraInSystems: true,
    },
  },
  {
    id: 'pit',
    label: 'Pit Tuning',
    description: 'Bigger data and tighter focus for adjustments near the robot cart.',
    layout: {
      uiScale: 'large',
      overviewLayout: 'pilot',
      diagnosticsLayout: 'deepDive',
      systemsLayout: 'stacked',
      showCameraInSystems: false,
    },
  },
  {
    id: 'analyst',
    label: 'Analyst Wall',
    description: 'Dense information layout for long sessions and deep inspection.',
    layout: {
      uiScale: 'compact',
      overviewLayout: 'dataWall',
      diagnosticsLayout: 'split',
      systemsLayout: 'cameraFocus',
      showCameraInSystems: true,
    },
  },
]

const defaultCameraFeeds: CameraFeedConfig[] = [
  {
    id: 'front',
    label: 'Front Camera',
    url: '',
    kind: 'mjpeg',
    enabled: false,
    refreshMs: 900,
  },
  {
    id: 'rear',
    label: 'Rear Camera',
    url: '',
    kind: 'mjpeg',
    enabled: false,
    refreshMs: 900,
  },
]

const defaultPreferences: DashboardPreferencesState = {
  layout: {
    ...layoutPresets[0].layout,
    layoutLocked: false,
  },
  cameraFeeds: defaultCameraFeeds,
  activePresetId: 'factory',
}

const uiScalePixels: Record<UiScaleId, string> = {
  compact: '15px',
  standard: '16px',
  large: '17px',
}

function sanitizeCameraFeed(feed: Partial<CameraFeedConfig>, fallback: CameraFeedConfig): CameraFeedConfig {
  return {
    id: typeof feed.id === 'string' && feed.id ? feed.id : fallback.id,
    label: typeof feed.label === 'string' && feed.label ? feed.label : fallback.label,
    url: typeof feed.url === 'string' ? feed.url : fallback.url,
    kind:
      feed.kind === 'mjpeg' || feed.kind === 'snapshot' || feed.kind === 'video'
        ? feed.kind
        : fallback.kind,
    enabled: typeof feed.enabled === 'boolean' ? feed.enabled : fallback.enabled,
    refreshMs:
      typeof feed.refreshMs === 'number' && Number.isFinite(feed.refreshMs)
        ? Math.max(250, Math.round(feed.refreshMs))
        : fallback.refreshMs,
  }
}

function detectPresetId(layout: DashboardLayoutSettings): LayoutPresetId | 'custom' {
  const matchedPreset = layoutPresets.find((preset) => {
    return (
      preset.layout.uiScale === layout.uiScale &&
      preset.layout.overviewLayout === layout.overviewLayout &&
      preset.layout.diagnosticsLayout === layout.diagnosticsLayout &&
      preset.layout.systemsLayout === layout.systemsLayout &&
      preset.layout.showCameraInSystems === layout.showCameraInSystems
    )
  })

  return matchedPreset?.id ?? 'custom'
}

function loadPreferences(): DashboardPreferencesState {
  try {
    const rawValue = window.localStorage.getItem(STORAGE_KEY)
    if (!rawValue) {
      return defaultPreferences
    }

    const parsed = JSON.parse(rawValue) as Partial<DashboardPreferencesState>
    const layout = (parsed.layout ?? {}) as Partial<DashboardLayoutSettings>
    const mergedLayout: DashboardLayoutSettings = {
      uiScale:
        layout.uiScale === 'compact' || layout.uiScale === 'standard' || layout.uiScale === 'large'
          ? layout.uiScale
          : defaultPreferences.layout.uiScale,
      overviewLayout:
        layout.overviewLayout === 'balanced' ||
        layout.overviewLayout === 'pilot' ||
        layout.overviewLayout === 'dataWall'
          ? layout.overviewLayout
          : defaultPreferences.layout.overviewLayout,
      diagnosticsLayout:
        layout.diagnosticsLayout === 'split' || layout.diagnosticsLayout === 'deepDive'
          ? layout.diagnosticsLayout
          : defaultPreferences.layout.diagnosticsLayout,
      systemsLayout:
        layout.systemsLayout === 'wide' ||
        layout.systemsLayout === 'stacked' ||
        layout.systemsLayout === 'cameraFocus'
          ? layout.systemsLayout
          : defaultPreferences.layout.systemsLayout,
      layoutLocked: typeof layout.layoutLocked === 'boolean' ? layout.layoutLocked : false,
      showCameraInSystems:
        typeof layout.showCameraInSystems === 'boolean'
          ? layout.showCameraInSystems
          : defaultPreferences.layout.showCameraInSystems,
    }

    const cameraFeeds = Array.isArray(parsed.cameraFeeds)
      ? defaultCameraFeeds.map((fallbackFeed, index) =>
          sanitizeCameraFeed(parsed.cameraFeeds?.[index] ?? {}, fallbackFeed),
        )
      : defaultCameraFeeds

    return {
      layout: mergedLayout,
      cameraFeeds,
      activePresetId: detectPresetId(mergedLayout),
    }
  } catch {
    return defaultPreferences
  }
}

export function DashboardPreferencesProvider({ children }: PropsWithChildren) {
  const [preferences, setPreferences] = useState<DashboardPreferencesState>(loadPreferences)

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences))
  }, [preferences])

  useEffect(() => {
    document.documentElement.style.fontSize = uiScalePixels[preferences.layout.uiScale]
  }, [preferences.layout.uiScale])

  const activeCameraFeeds = useMemo(
    () => preferences.cameraFeeds.filter((feed) => feed.enabled && feed.url.trim().length > 0),
    [preferences.cameraFeeds],
  )

  const setLayoutSetting = <K extends keyof DashboardLayoutSettings>(
    key: K,
    value: DashboardLayoutSettings[K],
  ) => {
    setPreferences((current) => {
      const nextLayout = {
        ...current.layout,
        [key]: value,
      }

      return {
        ...current,
        layout: nextLayout,
        activePresetId: detectPresetId(nextLayout),
      }
    })
  }

  const applyLayoutPreset = (presetId: LayoutPresetId) => {
    const preset = layoutPresets.find((item) => item.id === presetId)
    if (!preset) {
      return
    }

    setPreferences((current) => ({
      ...current,
      layout: {
        ...preset.layout,
        layoutLocked: current.layout.layoutLocked,
      },
      activePresetId: preset.id,
    }))
  }

  const resetLayout = () => {
    setPreferences((current) => ({
      ...current,
      layout: defaultPreferences.layout,
      activePresetId: 'factory',
    }))
  }

  const updateCameraFeed = (feedId: string, patch: Partial<CameraFeedConfig>) => {
    setPreferences((current) => ({
      ...current,
      cameraFeeds: current.cameraFeeds.map((feed) => {
        if (feed.id !== feedId) {
          return feed
        }

        return sanitizeCameraFeed(
          {
            ...feed,
            ...patch,
          },
          feed,
        )
      }),
    }))
  }

  const value = useMemo(
    () => ({
      preferences,
      layoutPresets,
      activeCameraFeeds,
      setLayoutSetting,
      applyLayoutPreset,
      resetLayout,
      updateCameraFeed,
    }),
    [activeCameraFeeds, preferences],
  )

  return <DashboardPreferencesContext.Provider value={value}>{children}</DashboardPreferencesContext.Provider>
}
