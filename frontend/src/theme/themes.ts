import type { ThemeTokens } from './tokens'

export type ThemeId = 'neutralPastel' | 'darkTechnical'

export interface ThemeDefinition {
  id: ThemeId
  label: string
  description: string
  tokens: ThemeTokens
}

export const themes: Record<ThemeId, ThemeDefinition> = {
  neutralPastel: {
    id: 'neutralPastel',
    label: 'Neutral Pastel',
    description: 'Warm off-white operational theme with calm technical accents.',
    tokens: {
      background: '#f5f2eb',
      backgroundSubtle: '#ece7df',
      surface: '#fffdfa',
      surfaceAlt: '#f4efe8',
      surfaceRaised: '#ffffff',
      border: '#d8d5d0',
      borderStrong: '#bcc3d3',
      text: '#243042',
      textMuted: '#6b778c',
      primary: '#6d92cf',
      primarySoft: '#dfe9f7',
      success: '#5a8f79',
      successSoft: '#e2efe8',
      warning: '#c28a47',
      warningSoft: '#f6ead8',
      danger: '#bf6e72',
      dangerSoft: '#f5e1e2',
      accent: '#7f87be',
      accentSoft: '#e6e3f5',
      info: '#5d88a8',
      infoSoft: '#ddeaf2',
      cardShadow: '0 10px 30px rgba(79, 90, 115, 0.08)',
      cardShadowStrong: '0 18px 42px rgba(79, 90, 115, 0.12)',
      gridLine: 'rgba(116, 139, 170, 0.12)',
      gaugeTrack: '#d7dee9',
      gaugeTick: '#8ea1bc',
      overlay: 'rgba(255, 255, 255, 0.72)',
    },
  },
  darkTechnical: {
    id: 'darkTechnical',
    label: 'Dark Technical',
    description: 'Low-light technical theme with restrained contrast and reliable status colors.',
    tokens: {
      background: '#0a1020',
      backgroundSubtle: '#0f1730',
      surface: '#121a2f',
      surfaceAlt: '#19233d',
      surfaceRaised: '#1f2b48',
      border: '#243554',
      borderStrong: '#3f5c87',
      text: '#edf4ff',
      textMuted: '#8ea4c5',
      primary: '#6f95ff',
      primarySoft: 'rgba(111, 149, 255, 0.18)',
      success: '#4fd09d',
      successSoft: 'rgba(79, 208, 157, 0.18)',
      warning: '#e7ad54',
      warningSoft: 'rgba(231, 173, 84, 0.18)',
      danger: '#ef6d7a',
      dangerSoft: 'rgba(239, 109, 122, 0.18)',
      accent: '#9b87f5',
      accentSoft: 'rgba(155, 135, 245, 0.18)',
      info: '#63c5e6',
      infoSoft: 'rgba(99, 197, 230, 0.18)',
      cardShadow: '0 16px 40px rgba(0, 0, 0, 0.26)',
      cardShadowStrong: '0 22px 60px rgba(0, 0, 0, 0.34)',
      gridLine: 'rgba(125, 162, 216, 0.12)',
      gaugeTrack: '#243554',
      gaugeTick: '#8ea4c5',
      overlay: 'rgba(10, 16, 32, 0.72)',
    },
  },
}
