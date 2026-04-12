import { createContext } from 'react'

export type UiScaleId = 'compact' | 'standard' | 'large'
export type OverviewLayoutId = 'balanced' | 'pilot' | 'dataWall'
export type DiagnosticsLayoutId = 'split' | 'deepDive'
export type SystemsLayoutId = 'wide' | 'stacked' | 'cameraFocus'
export type CameraFeedKind = 'mjpeg' | 'snapshot' | 'video'

export interface CameraFeedConfig {
  id: string
  label: string
  url: string
  kind: CameraFeedKind
  enabled: boolean
  refreshMs: number
}

export interface DashboardLayoutSettings {
  uiScale: UiScaleId
  overviewLayout: OverviewLayoutId
  diagnosticsLayout: DiagnosticsLayoutId
  systemsLayout: SystemsLayoutId
  layoutLocked: boolean
  showCameraInSystems: boolean
}

export interface DashboardPreferencesState {
  layout: DashboardLayoutSettings
  cameraFeeds: CameraFeedConfig[]
}

export interface DashboardPreferencesContextValue {
  preferences: DashboardPreferencesState
  activeCameraFeeds: CameraFeedConfig[]
  setLayoutSetting: <K extends keyof DashboardLayoutSettings>(
    key: K,
    value: DashboardLayoutSettings[K],
  ) => void
  resetLayout: () => void
  updateCameraFeed: (feedId: string, patch: Partial<CameraFeedConfig>) => void
}

export const DashboardPreferencesContext = createContext<DashboardPreferencesContextValue | null>(null)
