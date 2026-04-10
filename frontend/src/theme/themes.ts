import type { ThemeTokens } from './tokens'

export type ThemeId =
  | 'neutralPastel'
  | 'darkTechnical'
  | 'fieldCopper'
  | 'radarForest'
  | 'slateSignal'

export interface ThemeDefinition {
  id: ThemeId
  label: string
  description: string
  colorScheme: 'light' | 'dark'
  tokens: ThemeTokens
}

interface SemanticThemePalette {
  bgPrimary: string
  bgSurface: string
  bgElevated: string
  bgSubtle: string
  accentPrimary: string
  accentPrimarySoft: string
  accentSecondary: string
  accentSecondarySoft: string
  statusSuccess: string
  statusSuccessSoft: string
  statusWarning: string
  statusWarningSoft: string
  statusError: string
  statusErrorSoft: string
  statusInfo: string
  statusInfoSoft: string
  textPrimary: string
  textSecondary: string
  textMuted: string
  border: string
  borderStrong: string
  cardShadow: string
  cardShadowStrong: string
  gridLine: string
  gaugeTrack: string
  gaugeTick: string
  overlay: string
}

function createThemeTokens(palette: SemanticThemePalette): ThemeTokens {
  return {
    bgPrimary: palette.bgPrimary,
    bgSurface: palette.bgSurface,
    bgElevated: palette.bgElevated,
    accentPrimary: palette.accentPrimary,
    accentPrimarySoft: palette.accentPrimarySoft,
    accentSecondary: palette.accentSecondary,
    accentSecondarySoft: palette.accentSecondarySoft,
    statusSuccess: palette.statusSuccess,
    statusSuccessSoft: palette.statusSuccessSoft,
    statusWarning: palette.statusWarning,
    statusWarningSoft: palette.statusWarningSoft,
    statusError: palette.statusError,
    statusErrorSoft: palette.statusErrorSoft,
    statusInfo: palette.statusInfo,
    statusInfoSoft: palette.statusInfoSoft,
    textPrimary: palette.textPrimary,
    textSecondary: palette.textSecondary,
    textMuted: palette.textMuted,
    background: palette.bgPrimary,
    backgroundSubtle: palette.bgSubtle,
    surface: palette.bgSurface,
    surfaceAlt: palette.bgSubtle,
    surfaceRaised: palette.bgElevated,
    border: palette.border,
    borderStrong: palette.borderStrong,
    text: palette.textPrimary,
    primary: palette.accentPrimary,
    primarySoft: palette.accentPrimarySoft,
    success: palette.statusSuccess,
    successSoft: palette.statusSuccessSoft,
    warning: palette.statusWarning,
    warningSoft: palette.statusWarningSoft,
    danger: palette.statusError,
    dangerSoft: palette.statusErrorSoft,
    accent: palette.accentSecondary,
    accentSoft: palette.accentSecondarySoft,
    info: palette.statusInfo,
    infoSoft: palette.statusInfoSoft,
    cardShadow: palette.cardShadow,
    cardShadowStrong: palette.cardShadowStrong,
    gridLine: palette.gridLine,
    gaugeTrack: palette.gaugeTrack,
    gaugeTick: palette.gaugeTick,
    overlay: palette.overlay,
  }
}

export const themes: Record<ThemeId, ThemeDefinition> = {
  neutralPastel: {
    id: 'neutralPastel',
    label: 'Hotloop Night',
    description: 'Deep-black operator console with graphite surfaces, espresso copper focus and integrated cobalt highlights.',
    colorScheme: 'dark',
    tokens: createThemeTokens({
      bgPrimary: '#050608',
      bgSurface: '#101317',
      bgElevated: '#181d24',
      bgSubtle: '#121821',
      accentPrimary: '#8b5a3c',
      accentPrimarySoft: 'rgba(139, 90, 60, 0.2)',
      accentSecondary: '#3d8bff',
      accentSecondarySoft: 'rgba(61, 139, 255, 0.16)',
      statusSuccess: '#7ccb52',
      statusSuccessSoft: 'rgba(124, 203, 82, 0.16)',
      statusWarning: '#f0b454',
      statusWarningSoft: 'rgba(240, 180, 84, 0.16)',
      statusError: '#ef6f64',
      statusErrorSoft: 'rgba(239, 111, 100, 0.16)',
      statusInfo: '#56b5ff',
      statusInfoSoft: 'rgba(86, 181, 255, 0.16)',
      textPrimary: '#ffffff',
      textSecondary: '#d7dde8',
      textMuted: '#8f98aa',
      border: '#242a34',
      borderStrong: '#344154',
      cardShadow: '0 14px 34px rgba(0, 0, 0, 0.34)',
      cardShadowStrong: '0 22px 56px rgba(0, 0, 0, 0.48)',
      gridLine: 'rgba(61, 139, 255, 0.1)',
      gaugeTrack: '#232a33',
      gaugeTick: '#9aa6ba',
      overlay: 'rgba(5, 6, 8, 0.8)',
    }),
  },
  darkTechnical: {
    id: 'darkTechnical',
    label: 'Dark Technical',
    description: 'Low-light technical theme with restrained contrast and reliable status colors.',
    colorScheme: 'dark',
    tokens: createThemeTokens({
      bgPrimary: '#0a1020',
      bgSurface: '#121a2f',
      bgElevated: '#1f2b48',
      bgSubtle: '#19233d',
      accentPrimary: '#6f95ff',
      accentPrimarySoft: 'rgba(111, 149, 255, 0.18)',
      accentSecondary: '#63c5e6',
      accentSecondarySoft: 'rgba(99, 197, 230, 0.18)',
      statusSuccess: '#4fd09d',
      statusSuccessSoft: 'rgba(79, 208, 157, 0.18)',
      statusWarning: '#e7ad54',
      statusWarningSoft: 'rgba(231, 173, 84, 0.18)',
      statusError: '#ef6d7a',
      statusErrorSoft: 'rgba(239, 109, 122, 0.18)',
      statusInfo: '#87b3ff',
      statusInfoSoft: 'rgba(135, 179, 255, 0.18)',
      textPrimary: '#edf4ff',
      textSecondary: '#c2d0e5',
      textMuted: '#8ea4c5',
      border: '#243554',
      borderStrong: '#3f5c87',
      cardShadow: '0 16px 40px rgba(0, 0, 0, 0.26)',
      cardShadowStrong: '0 22px 60px rgba(0, 0, 0, 0.34)',
      gridLine: 'rgba(125, 162, 216, 0.12)',
      gaugeTrack: '#243554',
      gaugeTick: '#8ea4c5',
      overlay: 'rgba(10, 16, 32, 0.72)',
    }),
  },
  fieldCopper: {
    id: 'fieldCopper',
    label: 'Field Copper',
    description: 'Warm field-side palette with brass accents and lighter instrumentation surfaces.',
    colorScheme: 'light',
    tokens: createThemeTokens({
      bgPrimary: '#efe8dd',
      bgSurface: '#fcf7f0',
      bgElevated: '#fffaf3',
      bgSubtle: '#f1e8dd',
      accentPrimary: '#8a6d4d',
      accentPrimarySoft: '#ebdecf',
      accentSecondary: '#4a7d8f',
      accentSecondarySoft: '#d8e8ee',
      statusSuccess: '#4f8a6b',
      statusSuccessSoft: '#dbeee4',
      statusWarning: '#cb8a2c',
      statusWarningSoft: '#f7e4c6',
      statusError: '#b75d51',
      statusErrorSoft: '#f2ddd8',
      statusInfo: '#6d92cf',
      statusInfoSoft: '#dfe9f7',
      textPrimary: '#2f261f',
      textSecondary: '#5b4d40',
      textMuted: '#75685b',
      border: '#d2c4b4',
      borderStrong: '#ae8f6d',
      cardShadow: '0 14px 34px rgba(96, 74, 51, 0.12)',
      cardShadowStrong: '0 22px 48px rgba(96, 74, 51, 0.18)',
      gridLine: 'rgba(143, 109, 74, 0.12)',
      gaugeTrack: '#dac8b5',
      gaugeTick: '#9a7c5e',
      overlay: 'rgba(252, 247, 240, 0.74)',
    }),
  },
  radarForest: {
    id: 'radarForest',
    label: 'Radar Forest',
    description: 'Dark green operations deck with radar-inspired contrast and softer highlights.',
    colorScheme: 'dark',
    tokens: createThemeTokens({
      bgPrimary: '#07130f',
      bgSurface: '#10211b',
      bgElevated: '#1b332a',
      bgSubtle: '#162a22',
      accentPrimary: '#59c38f',
      accentPrimarySoft: 'rgba(89, 195, 143, 0.18)',
      accentSecondary: '#5eb8c6',
      accentSecondarySoft: 'rgba(94, 184, 198, 0.18)',
      statusSuccess: '#7dda8a',
      statusSuccessSoft: 'rgba(125, 218, 138, 0.18)',
      statusWarning: '#e5b75c',
      statusWarningSoft: 'rgba(229, 183, 92, 0.16)',
      statusError: '#eb7373',
      statusErrorSoft: 'rgba(235, 115, 115, 0.18)',
      statusInfo: '#72a69a',
      statusInfoSoft: 'rgba(114, 166, 154, 0.18)',
      textPrimary: '#ecf6f0',
      textSecondary: '#c3d9cf',
      textMuted: '#9cb8ac',
      border: '#224238',
      borderStrong: '#3d6f5e',
      cardShadow: '0 16px 42px rgba(0, 0, 0, 0.34)',
      cardShadowStrong: '0 24px 58px rgba(0, 0, 0, 0.42)',
      gridLine: 'rgba(110, 181, 148, 0.12)',
      gaugeTrack: '#234338',
      gaugeTick: '#87b39e',
      overlay: 'rgba(7, 19, 15, 0.76)',
    }),
  },
  slateSignal: {
    id: 'slateSignal',
    label: 'Slate Signal',
    description: 'Blue-slate command surface with brighter signal accents and cooler contrast.',
    colorScheme: 'dark',
    tokens: createThemeTokens({
      bgPrimary: '#10161d',
      bgSurface: '#18232f',
      bgElevated: '#263446',
      bgSubtle: '#1f2b38',
      accentPrimary: '#74a8ff',
      accentPrimarySoft: 'rgba(116, 168, 255, 0.18)',
      accentSecondary: '#6ac4d8',
      accentSecondarySoft: 'rgba(106, 196, 216, 0.18)',
      statusSuccess: '#58d4a2',
      statusSuccessSoft: 'rgba(88, 212, 162, 0.18)',
      statusWarning: '#f0b35d',
      statusWarningSoft: 'rgba(240, 179, 93, 0.18)',
      statusError: '#f1767f',
      statusErrorSoft: 'rgba(241, 118, 127, 0.18)',
      statusInfo: '#87b3ff',
      statusInfoSoft: 'rgba(135, 179, 255, 0.18)',
      textPrimary: '#eef4fb',
      textSecondary: '#d2ddea',
      textMuted: '#9aaec4',
      border: '#304255',
      borderStrong: '#55718f',
      cardShadow: '0 14px 40px rgba(0, 0, 0, 0.28)',
      cardShadowStrong: '0 22px 56px rgba(0, 0, 0, 0.36)',
      gridLine: 'rgba(124, 163, 224, 0.12)',
      gaugeTrack: '#324659',
      gaugeTick: '#9bb1c9',
      overlay: 'rgba(16, 22, 29, 0.76)',
    }),
  },
}
