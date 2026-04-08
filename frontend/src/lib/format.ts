export function formatSigned(value: number, digits = 2) {
  return `${value >= 0 ? '+' : ''}${value.toFixed(digits)}`
}

export function formatDegrees(value: number, digits = 1) {
  return `${value.toFixed(digits)} deg`
}

export function formatMillimeters(value: number, digits = 0) {
  return `${value.toFixed(digits)} mm`
}

export function formatCentimeters(value: number, digits = 1) {
  return `${value.toFixed(digits)} cm`
}

export function formatMeters(value: number, digits = 2) {
  return `${value.toFixed(digits)} m`
}

export function formatSeconds(value: number, digits = 1) {
  return `${value.toFixed(digits)} s`
}

export function formatCommand(value: number) {
  return formatSigned(value, 2)
}

export function formatClock(isoTimestamp: string) {
  return new Date(isoTimestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}
