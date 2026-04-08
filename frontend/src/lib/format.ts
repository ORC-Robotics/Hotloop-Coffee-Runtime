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

export function formatVoltage(value: number, digits = 2) {
  return `${value.toFixed(digits)} V`
}

export function formatCurrent(value: number, digits = 1) {
  return `${value.toFixed(digits)} A`
}

export function formatPower(value: number, digits = 0) {
  return `${value.toFixed(digits)} W`
}

export function formatPercent(value: number, digits = 0) {
  return `${(value * 100).toFixed(digits)}%`
}

export function formatDurationMinutes(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return '--'
  }

  const totalMinutes = Math.max(0, Math.round(value))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }

  return `${minutes} min`
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
