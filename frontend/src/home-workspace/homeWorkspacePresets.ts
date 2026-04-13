export type HomeWorkspacePresetId =
  | 'battery-watch'
  | 'heading-gyro'
  | 'systems-health'
  | 'commands'
  | 'alerts'

export interface HomeWorkspacePresetDefinition {
  defaultHeight: number
  defaultTitle: string
  defaultWidth: number
  description: string
  id: HomeWorkspacePresetId
  label: string
}

export const HOME_WORKSPACE_PRESET_DEFINITIONS: HomeWorkspacePresetDefinition[] = [
  {
    id: 'battery-watch',
    label: 'Battery Watch',
    defaultTitle: 'Battery Watch',
    description: 'Voltage trend, pack load and runtime estimate.',
    defaultWidth: 6,
    defaultHeight: 4,
  },
  {
    id: 'heading-gyro',
    label: 'Heading / Gyro',
    defaultTitle: 'Heading / Gyro',
    description: 'Orientation, target heading and angular error.',
    defaultWidth: 6,
    defaultHeight: 4,
  },
  {
    id: 'systems-health',
    label: 'Systems Health',
    defaultTitle: 'Systems Health',
    description: 'Sensor chain readiness and gyro-hold state.',
    defaultWidth: 5,
    defaultHeight: 3,
  },
  {
    id: 'commands',
    label: 'Commands',
    defaultTitle: 'Commands',
    description: 'Live drive command vectors and narrative.',
    defaultWidth: 5,
    defaultHeight: 4,
  },
  {
    id: 'alerts',
    label: 'Alerts',
    defaultTitle: 'Alerts',
    description: 'Top operational warnings in the current session.',
    defaultWidth: 5,
    defaultHeight: 4,
  },
]

const presetDefinitionMap = new Map(HOME_WORKSPACE_PRESET_DEFINITIONS.map((preset) => [preset.id, preset]))

export function getHomeWorkspacePresetDefinition(
  presetId: HomeWorkspacePresetId | null | undefined,
): HomeWorkspacePresetDefinition | null {
  if (!presetId) {
    return null
  }

  return presetDefinitionMap.get(presetId) ?? null
}

export function isHomeWorkspacePresetId(value: unknown): value is HomeWorkspacePresetId {
  return typeof value === 'string' && presetDefinitionMap.has(value as HomeWorkspacePresetId)
}
