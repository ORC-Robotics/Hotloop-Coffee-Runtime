import { useMemo } from 'react'
import { formatCurrent, formatDurationMinutes, formatPercent, formatPower, formatVoltage } from '../../lib/format'
import type { BatteryData, BatteryHistoryPoint, UiTone } from '../../types/telemetry'
import { DashboardCard } from './DashboardCard'
import { StatusBadge } from './StatusBadge'

interface BatteryPanelProps {
  battery: BatteryData
  history: BatteryHistoryPoint[]
}

function voltageTone(voltageV: number): UiTone {
  if (voltageV <= 0) return 'neutral'
  if (voltageV < 11.0) return 'critical'
  if (voltageV < 11.8) return 'warning'
  return 'good'
}

function stabilityTone(points: BatteryHistoryPoint[]): UiTone {
  if (points.length < 4) {
    return 'neutral'
  }

  let minVoltage = Number.POSITIVE_INFINITY
  let maxVoltage = Number.NEGATIVE_INFINITY
  for (const point of points) {
    minVoltage = Math.min(minVoltage, point.voltageV)
    maxVoltage = Math.max(maxVoltage, point.voltageV)
  }

  const spread = maxVoltage - minVoltage
  if (spread > 0.45) return 'critical'
  if (spread > 0.2) return 'warning'
  return 'good'
}

function toneLabel(tone: UiTone) {
  if (tone === 'good') return 'stable'
  if (tone === 'warning') return 'droop'
  if (tone === 'critical') return 'critical'
  if (tone === 'info') return 'info'
  return 'waiting'
}

function sparklinePoints(points: BatteryHistoryPoint[], width: number, height: number) {
  if (!points.length) {
    return ''
  }

  let minVoltage = Number.POSITIVE_INFINITY
  let maxVoltage = Number.NEGATIVE_INFINITY
  for (const point of points) {
    minVoltage = Math.min(minVoltage, point.voltageV)
    maxVoltage = Math.max(maxVoltage, point.voltageV)
  }

  const paddedMin = Math.max(0, minVoltage - 0.08)
  const paddedMax = maxVoltage + 0.08
  const range = Math.max(0.2, paddedMax - paddedMin)

  return points
    .map((point, index) => {
      const x = points.length === 1 ? width / 2 : (index / (points.length - 1)) * width
      const y = height - ((point.voltageV - paddedMin) / range) * height
      return `${x},${y}`
    })
    .join(' ')
}

export function BatteryPanel({ battery, history }: BatteryPanelProps) {
  const currentTone = voltageTone(battery.voltageV)
  const graphTone = stabilityTone(history)
  const sparkline = useMemo(() => sparklinePoints(history, 540, 150), [history])
  const socPercent = Math.max(0, Math.min(100, battery.stateOfCharge * 100))

  return (
    <DashboardCard
      title="Battery Watch"
      subtitle="voltage, draw and runtime estimate"
      accent="warning"
      className="min-h-[0]"
      headerSlot={
        <div className="flex flex-wrap gap-2">
          <StatusBadge tone={currentTone} label={battery.voltageV > 0 ? formatVoltage(battery.voltageV, 2) : 'no pack'} />
          <StatusBadge tone={graphTone} label={toneLabel(graphTone)} />
        </div>
      }
    >
      <div className="grid h-full gap-3">
        <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface-alt)]/84 p-3">
          {history.length ? (
            <svg viewBox="0 0 540 150" className="h-[160px] w-full">
              {Array.from({ length: 6 }, (_, index) => {
                const y = (index / 5) * 150
                return <line key={index} x1="0" y1={y} x2="540" y2={y} stroke="var(--gridLine)" strokeWidth="1" />
              })}
              <polyline
                fill="none"
                stroke="var(--warning)"
                strokeWidth="3"
                strokeLinejoin="round"
                strokeLinecap="round"
                points={sparkline}
              />
            </svg>
          ) : (
            <div className="flex h-[160px] items-center justify-center rounded-[14px] border border-dashed border-[var(--border)] text-[0.84rem] text-[var(--text-muted)]">
              Waiting for a live battery stream.
            </div>
          )}
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-[0.76rem] text-[var(--text-muted)]">
            <div>Recent voltage trend</div>
            <div>{history.length ? `${history.length} samples` : 'no samples yet'}</div>
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-4">
          {[
            ['Voltage', battery.voltageV > 0 ? formatVoltage(battery.voltageV, 2) : '--', 'pack input now'],
            ['Current', battery.currentA > 0 ? formatCurrent(battery.currentA, 1) : '--', 'instantaneous draw'],
            ['Power', battery.powerW > 0 ? formatPower(battery.powerW, 0) : '--', 'electrical load'],
            ['Est. runtime', formatDurationMinutes(battery.estimatedRuntimeMin), 'conservative estimate under minimum drivetrain load'],
          ].map(([label, value, detail]) => (
            <div key={label} className="rounded-[16px] border border-[var(--border)] bg-[var(--surface-alt)]/82 px-3 py-2.5">
              <div className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">{label}</div>
              <div className="mt-1.5 font-mono text-[0.94rem] text-[var(--text)]">{value}</div>
              <div className="mt-1 text-[0.72rem] leading-5 text-[var(--text-muted)]">{detail}</div>
            </div>
          ))}
        </div>

        <div className="rounded-[16px] border border-[var(--border)] bg-[var(--surface-alt)]/82 px-3 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
              Estimated state of charge
            </div>
            <div className="font-mono text-[0.84rem] text-[var(--text)]">{formatPercent(battery.stateOfCharge, 0)}</div>
          </div>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-[var(--surface)]">
            <div
              className="h-full rounded-full transition-[width]"
              style={{
                width: `${socPercent}%`,
                background:
                  currentTone === 'critical'
                    ? 'var(--danger)'
                    : currentTone === 'warning'
                      ? 'var(--warning)'
                      : 'var(--success)',
              }}
            />
          </div>
        </div>
      </div>
    </DashboardCard>
  )
}
