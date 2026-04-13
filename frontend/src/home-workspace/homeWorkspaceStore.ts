import {
  getHomeWorkspacePresetDefinition,
  isHomeWorkspacePresetId,
  type HomeWorkspacePresetId,
} from './homeWorkspacePresets'

export type HomeWorkspaceWidgetRenderer =
  | 'auto'
  | 'number'
  | 'stat'
  | 'gauge'
  | 'bar'
  | 'sparkline'
  | 'boolean-light'
  | 'boolean-pill'
  | 'boolean-tile'
  | 'text-line'
  | 'text-tile'

export interface HomeWorkspaceWidgetConfig {
  compact: boolean
  decimals: number
  units: string
  warningMin: number | null
  warningMax: number | null
  criticalMin: number | null
  criticalMax: number | null
}

interface HomeWorkspaceWidgetBase {
  id: string
  title: string
  x: number
  y: number
  w: number
  h: number
}

export interface HomeWorkspaceTopicWidget extends HomeWorkspaceWidgetBase {
  kind: 'topic'
  topicKey: string | null
  renderer: HomeWorkspaceWidgetRenderer
  config: HomeWorkspaceWidgetConfig
}

export interface HomeWorkspacePresetWidget extends HomeWorkspaceWidgetBase {
  kind: 'preset'
  presetId: HomeWorkspacePresetId
}

export type HomeWorkspaceWidget = HomeWorkspaceTopicWidget | HomeWorkspacePresetWidget

export interface HomeWorkspacePage {
  id: string
  title: string
  widgets: HomeWorkspaceWidget[]
}

export interface HomeWorkspaceState {
  activePageId: string
  pages: HomeWorkspacePage[]
  lastSavedAt: string
}

interface LegacyHomeWorkspaceSlot {
  id?: string
  moduleId?: string | null
  size?: 'standard' | 'wide'
}

interface LegacyHomeWorkspacePage {
  id?: string
  title?: string
  slots?: LegacyHomeWorkspaceSlot[]
}

export const HOME_WORKSPACE_STORAGE_KEY = 'orion.home-workspace.v3'
export const HOME_WORKSPACE_V2_STORAGE_KEY = 'orion.home-workspace.v2'
export const HOME_WORKSPACE_LEGACY_STORAGE_KEY = 'orion.home-workspace.v1'
export const HOME_WORKSPACE_MAX_PAGES = 8
export const HOME_WORKSPACE_GRID_COLUMNS = 12
export const HOME_WORKSPACE_GRID_ROW_PX = 44
export const HOME_WORKSPACE_GRID_GAP_PX = 12
export const HOME_WORKSPACE_MIN_WIDGET_W = 2
export const HOME_WORKSPACE_MAX_WIDGET_W = HOME_WORKSPACE_GRID_COLUMNS
export const HOME_WORKSPACE_MIN_WIDGET_H = 2
export const HOME_WORKSPACE_MAX_WIDGET_H = 8

function createId(prefix: string) {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`
  }

  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

function sanitizeInteger(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : fallback
}

function parseOptionalNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function clampDecimals(value: number) {
  return Math.max(0, Math.min(4, Math.round(value)))
}

function sanitizeRenderer(value: unknown): HomeWorkspaceWidgetRenderer {
  return value === 'number' ||
    value === 'stat' ||
    value === 'gauge' ||
    value === 'bar' ||
    value === 'sparkline' ||
    value === 'boolean-light' ||
    value === 'boolean-pill' ||
    value === 'boolean-tile' ||
    value === 'text-line' ||
    value === 'text-tile'
    ? value
    : 'auto'
}

export function createDefaultWidgetConfig(): HomeWorkspaceWidgetConfig {
  return {
    compact: false,
    decimals: 1,
    units: '',
    warningMin: null,
    warningMax: null,
    criticalMin: null,
    criticalMax: null,
  }
}

function sanitizeWidgetConfig(value: unknown): HomeWorkspaceWidgetConfig {
  if (!value || typeof value !== 'object') {
    return createDefaultWidgetConfig()
  }

  const candidate = value as Partial<HomeWorkspaceWidgetConfig>

  return {
    compact: candidate.compact === true,
    decimals:
      typeof candidate.decimals === 'number' && Number.isFinite(candidate.decimals)
        ? clampDecimals(candidate.decimals)
        : 1,
    units: typeof candidate.units === 'string' ? candidate.units.trim().slice(0, 16) : '',
    warningMin: parseOptionalNumber(candidate.warningMin),
    warningMax: parseOptionalNumber(candidate.warningMax),
    criticalMin: parseOptionalNumber(candidate.criticalMin),
    criticalMax: parseOptionalNumber(candidate.criticalMax),
  }
}

export function isHomeWorkspaceTopicWidget(widget: HomeWorkspaceWidget): widget is HomeWorkspaceTopicWidget {
  return widget.kind === 'topic'
}

export function isHomeWorkspacePresetWidget(widget: HomeWorkspaceWidget): widget is HomeWorkspacePresetWidget {
  return widget.kind === 'preset'
}

function clampWidgetRect<T extends HomeWorkspaceWidget>(widget: T): T {
  const w = Math.max(HOME_WORKSPACE_MIN_WIDGET_W, Math.min(HOME_WORKSPACE_MAX_WIDGET_W, widget.w))
  const h = Math.max(HOME_WORKSPACE_MIN_WIDGET_H, Math.min(HOME_WORKSPACE_MAX_WIDGET_H, widget.h))
  const x = Math.max(0, Math.min(HOME_WORKSPACE_GRID_COLUMNS - w, widget.x))
  const y = Math.max(0, widget.y)

  return {
    ...widget,
    x,
    y,
    w,
    h,
  }
}

function widgetsOverlap(a: Pick<HomeWorkspaceWidget, 'id' | 'x' | 'y' | 'w' | 'h'>, b: Pick<HomeWorkspaceWidget, 'id' | 'x' | 'y' | 'w' | 'h'>) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

function canPlaceWidget(
  widgets: HomeWorkspaceWidget[],
  candidate: Pick<HomeWorkspaceWidget, 'id' | 'x' | 'y' | 'w' | 'h'>,
) {
  return widgets.every((widget) => widget.id === candidate.id || !widgetsOverlap(widget, candidate))
}

export function findFreeWidgetPosition(
  widgets: HomeWorkspaceWidget[],
  width: number,
  height: number,
  preferredX = 0,
  preferredY = 0,
) {
  const w = Math.max(HOME_WORKSPACE_MIN_WIDGET_W, Math.min(HOME_WORKSPACE_MAX_WIDGET_W, Math.round(width)))
  const h = Math.max(HOME_WORKSPACE_MIN_WIDGET_H, Math.min(HOME_WORKSPACE_MAX_WIDGET_H, Math.round(height)))
  const startY = Math.max(0, Math.round(preferredY))
  const startX = Math.max(0, Math.min(HOME_WORKSPACE_GRID_COLUMNS - w, Math.round(preferredX)))

  for (let y = startY; y < 240; y += 1) {
    for (let x = y === startY ? startX : 0; x <= HOME_WORKSPACE_GRID_COLUMNS - w; x += 1) {
      const candidate = { id: 'candidate', x, y, w, h }
      if (canPlaceWidget(widgets, candidate)) {
        return { x, y }
      }
    }
  }

  return { x: 0, y: startY }
}

export function placeWidgetInLayout<T extends HomeWorkspaceWidget>(widgets: HomeWorkspaceWidget[], widget: T): T {
  const clamped = clampWidgetRect(widget)
  const position = findFreeWidgetPosition(widgets, clamped.w, clamped.h, clamped.x, clamped.y)
  return {
    ...clamped,
    x: position.x,
    y: position.y,
  }
}

export function createHomeWorkspaceWidget(
  widgets: HomeWorkspaceWidget[],
  overrides: Partial<HomeWorkspaceTopicWidget> = {},
): HomeWorkspaceTopicWidget {
  const base: HomeWorkspaceTopicWidget = {
    kind: 'topic',
    id: typeof overrides.id === 'string' && overrides.id ? overrides.id : createId('widget'),
    title: typeof overrides.title === 'string' && overrides.title.trim() ? overrides.title.trim() : 'New Widget',
    topicKey: typeof overrides.topicKey === 'string' && overrides.topicKey.trim() ? overrides.topicKey.trim() : null,
    renderer: sanitizeRenderer(overrides.renderer),
    x: sanitizeInteger(overrides.x, 0),
    y: sanitizeInteger(overrides.y, 0),
    w: sanitizeInteger(overrides.w, 4),
    h: sanitizeInteger(overrides.h, 3),
    config: {
      ...createDefaultWidgetConfig(),
      ...sanitizeWidgetConfig(overrides.config),
    },
  }

  return placeWidgetInLayout(widgets, base)
}

export function createHomeWorkspacePresetWidget(
  widgets: HomeWorkspaceWidget[],
  presetId: HomeWorkspacePresetId,
  overrides: Partial<HomeWorkspacePresetWidget> = {},
): HomeWorkspacePresetWidget {
  const preset = getHomeWorkspacePresetDefinition(presetId)
  const base: HomeWorkspacePresetWidget = {
    kind: 'preset',
    id: typeof overrides.id === 'string' && overrides.id ? overrides.id : createId('widget'),
    title: typeof overrides.title === 'string' && overrides.title.trim() ? overrides.title.trim() : preset?.defaultTitle ?? 'Preset Widget',
    presetId,
    x: sanitizeInteger(overrides.x, 0),
    y: sanitizeInteger(overrides.y, 0),
    w: sanitizeInteger(overrides.w, preset?.defaultWidth ?? 5),
    h: sanitizeInteger(overrides.h, preset?.defaultHeight ?? 4),
  }

  return placeWidgetInLayout(widgets, base)
}

export function createHomeWorkspacePage(title: string): HomeWorkspacePage {
  return {
    id: createId('page'),
    title,
    widgets: [],
  }
}

function createDefaultPages() {
  return [1, 2, 3].map((index) => createHomeWorkspacePage(`Page ${index}`))
}

export function createDefaultHomeWorkspaceState(): HomeWorkspaceState {
  const pages = createDefaultPages()

  return {
    activePageId: pages[0].id,
    pages,
    lastSavedAt: new Date().toISOString(),
  }
}

function presetFromLegacyModuleId(moduleId: string | null | undefined): HomeWorkspacePresetId | null {
  const normalized = moduleId?.trim().toLowerCase()
  if (!normalized) {
    return null
  }

  if (normalized === 'battery' || normalized === 'battery-watch') return 'battery-watch'
  if (normalized === 'heading' || normalized === 'heading-gyro' || normalized === 'gyro') return 'heading-gyro'
  if (normalized === 'systems' || normalized === 'systems-health') return 'systems-health'
  if (normalized === 'commands') return 'commands'
  if (normalized === 'alerts') return 'alerts'
  return null
}

function sanitizeTopicWidget(
  candidate: Partial<HomeWorkspaceTopicWidget>,
  index: number,
  widgets: HomeWorkspaceWidget[],
): HomeWorkspaceTopicWidget {
  return createHomeWorkspaceWidget(widgets, {
    id: typeof candidate.id === 'string' && candidate.id ? candidate.id : createId('widget'),
    title:
      typeof candidate.title === 'string' && candidate.title.trim().length
        ? candidate.title.trim()
        : `Widget ${index + 1}`,
    topicKey: typeof candidate.topicKey === 'string' ? candidate.topicKey : null,
    renderer: sanitizeRenderer(candidate.renderer),
    x: sanitizeInteger(candidate.x, 0),
    y: sanitizeInteger(candidate.y, 0),
    w: sanitizeInteger(candidate.w, 4),
    h: sanitizeInteger(candidate.h, 3),
    config: sanitizeWidgetConfig(candidate.config),
  })
}

function sanitizePresetWidget(
  candidate: Partial<HomeWorkspacePresetWidget>,
  index: number,
  widgets: HomeWorkspaceWidget[],
): HomeWorkspacePresetWidget | null {
  if (!isHomeWorkspacePresetId(candidate.presetId)) {
    return null
  }

  return createHomeWorkspacePresetWidget(widgets, candidate.presetId, {
    id: typeof candidate.id === 'string' && candidate.id ? candidate.id : createId('widget'),
    title:
      typeof candidate.title === 'string' && candidate.title.trim().length
        ? candidate.title.trim()
        : getHomeWorkspacePresetDefinition(candidate.presetId)?.defaultTitle ?? `Preset ${index + 1}`,
    x: sanitizeInteger(candidate.x, 0),
    y: sanitizeInteger(candidate.y, 0),
    w: sanitizeInteger(candidate.w, getHomeWorkspacePresetDefinition(candidate.presetId)?.defaultWidth ?? 5),
    h: sanitizeInteger(candidate.h, getHomeWorkspacePresetDefinition(candidate.presetId)?.defaultHeight ?? 4),
  })
}

function sanitizeWidget(
  value: unknown,
  index: number,
  widgets: HomeWorkspaceWidget[],
): HomeWorkspaceWidget | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const candidate = value as Partial<HomeWorkspaceWidget & { presetId?: HomeWorkspacePresetId }>

  if (candidate.kind === 'preset' || isHomeWorkspacePresetId(candidate.presetId)) {
    return sanitizePresetWidget(candidate as Partial<HomeWorkspacePresetWidget>, index, widgets)
  }

  return sanitizeTopicWidget(candidate as Partial<HomeWorkspaceTopicWidget>, index, widgets)
}

function migrateLegacySlots(slots: LegacyHomeWorkspaceSlot[]) {
  const widgets: HomeWorkspaceWidget[] = []

  slots.forEach((slot, index) => {
    const presetId = presetFromLegacyModuleId(slot.moduleId)
    if (presetId) {
      const preset = getHomeWorkspacePresetDefinition(presetId)
      widgets.push(
        createHomeWorkspacePresetWidget(widgets, presetId, {
          id: typeof slot.id === 'string' && slot.id ? slot.id : createId('widget'),
          w: slot.size === 'wide' ? Math.max(6, preset?.defaultWidth ?? 6) : preset?.defaultWidth,
          h: preset?.defaultHeight,
        }),
      )
      return
    }

    widgets.push(
      createHomeWorkspaceWidget(widgets, {
        id: typeof slot.id === 'string' && slot.id ? slot.id : createId('widget'),
        title: `Widget ${index + 1}`,
        w: slot.size === 'wide' ? 6 : 4,
        h: 3,
      }),
    )
  })

  return widgets
}

function sanitizePage(value: unknown, index: number): HomeWorkspacePage | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const candidate = value as Partial<HomeWorkspacePage & LegacyHomeWorkspacePage>
  const widgets: HomeWorkspaceWidget[] = []

  if (Array.isArray(candidate.widgets)) {
    candidate.widgets.forEach((widget, widgetIndex) => {
      const safeWidget = sanitizeWidget(widget, widgetIndex, widgets)
      if (safeWidget) {
        widgets.push(safeWidget)
      }
    })
  } else if (Array.isArray(candidate.slots)) {
    widgets.push(...migrateLegacySlots(candidate.slots))
  }

  return {
    id: typeof candidate.id === 'string' && candidate.id ? candidate.id : createId('page'),
    title:
      typeof candidate.title === 'string' && candidate.title.trim().length
        ? candidate.title.trim()
        : `Page ${index + 1}`,
    widgets,
  }
}

function loadRawWorkspaceState(storageKey: string) {
  if (typeof window === 'undefined') {
    return null
  }

  const rawValue = window.localStorage.getItem(storageKey)
  if (!rawValue) {
    return null
  }

  try {
    return JSON.parse(rawValue) as Partial<HomeWorkspaceState>
  } catch {
    return null
  }
}

export function loadHomeWorkspaceState(): HomeWorkspaceState {
  const parsed =
    loadRawWorkspaceState(HOME_WORKSPACE_STORAGE_KEY) ??
    loadRawWorkspaceState(HOME_WORKSPACE_V2_STORAGE_KEY) ??
    loadRawWorkspaceState(HOME_WORKSPACE_LEGACY_STORAGE_KEY)
  if (!parsed) {
    return createDefaultHomeWorkspaceState()
  }

  const pages = Array.isArray(parsed.pages)
    ? parsed.pages
        .map((page, index) => sanitizePage(page, index))
        .filter((page): page is HomeWorkspacePage => page !== null)
    : []

  const safePages = pages.length ? pages : createDefaultPages()
  const activePageId = safePages.some((page) => page.id === parsed.activePageId)
    ? parsed.activePageId ?? safePages[0].id
    : safePages[0].id

  return {
    activePageId,
    pages: safePages,
    lastSavedAt:
      typeof parsed.lastSavedAt === 'string' && parsed.lastSavedAt
        ? parsed.lastSavedAt
        : new Date().toISOString(),
  }
}

export function persistHomeWorkspaceState(state: HomeWorkspaceState) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(HOME_WORKSPACE_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Ignore local persistence failures and keep the in-memory workspace state.
  }
}
