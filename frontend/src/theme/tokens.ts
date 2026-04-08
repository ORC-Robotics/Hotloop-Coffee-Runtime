export interface ThemeTokens {
  background: string
  backgroundSubtle: string
  surface: string
  surfaceAlt: string
  surfaceRaised: string
  border: string
  borderStrong: string
  text: string
  textMuted: string
  primary: string
  primarySoft: string
  success: string
  successSoft: string
  warning: string
  warningSoft: string
  danger: string
  dangerSoft: string
  accent: string
  accentSoft: string
  info: string
  infoSoft: string
  cardShadow: string
  cardShadowStrong: string
  gridLine: string
  gaugeTrack: string
  gaugeTick: string
  overlay: string
}

export function toCssVariables(tokens: ThemeTokens) {
  return Object.fromEntries(
    Object.entries(tokens).map(([key, value]) => [
      `--${key.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`)}`,
      value,
    ]),
  )
}
