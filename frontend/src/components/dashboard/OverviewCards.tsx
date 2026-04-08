import { formatMillimeters } from '../../lib/format'
import type { TelemetryDerivedState, TelemetrySnapshot, UiTone } from '../../types/telemetry'
import { DashboardCard } from './DashboardCard'
import { StatusBadge } from './StatusBadge'

interface OverviewCardsProps {
  snapshot: TelemetrySnapshot
  derived: TelemetryDerivedState
}

interface OverviewCardItem {
  title: string
  value: string
  detail: string
  tone: UiTone
  accent: 'info' | 'primary' | 'warning' | 'accent'
}

function toneLabel(tone: UiTone) {
  if (tone === 'critical') return 'critical'
  if (tone === 'warning') return 'warning'
  if (tone === 'good') return 'nominal'
  if (tone === 'info') return 'info'
  return 'neutral'
}

export function OverviewCards({ snapshot, derived }: OverviewCardsProps) {
  const cards: OverviewCardItem[] = [
    {
      title: 'Link',
      value: snapshot.connection.online ? 'ONLINE' : 'OFFLINE',
      detail: `${snapshot.connection.mode} via ${snapshot.connection.target}`,
      tone: derived.connectionTone,
      accent: 'info',
    },
    {
      title: 'Robot / Target',
      value: snapshot.connection.target,
      detail: snapshot.connection.online ? 'tracking host route' : 'standby until bridge sync',
      tone: derived.robotHealthTone,
      accent: 'primary',
    },
    {
      title: 'Front Median',
      value: formatMillimeters(snapshot.perception.frontMedianMm),
      detail: derived.frontClearanceTone === 'critical' ? 'frontal restriction active' : 'forward clearance estimate',
      tone: derived.frontClearanceTone,
      accent: 'warning',
    },
    {
      title: 'Reactive State',
      value: snapshot.reactive.state,
      detail: snapshot.reactive.lastTurn === 'none' ? 'steady planner flow' : `last turn ${snapshot.reactive.lastTurn}`,
      tone: derived.robotHealthTone === 'critical' ? 'warning' : 'info',
      accent: 'accent',
    },
  ]

  return (
    <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
      {cards.map((card) => (
        <DashboardCard
          key={card.title}
          title={card.title}
          subtitle="summary"
          accent={card.accent}
          className="min-h-[98px]"
          headerSlot={<StatusBadge tone={card.tone} label={toneLabel(card.tone)} />}
        >
          <div className="flex h-full items-end justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-[clamp(0.96rem,0.9rem+0.38vw,1.24rem)] font-semibold tracking-[-0.04em] text-[var(--text)]">
                {card.value}
              </div>
              <p className="mt-1 text-[0.75rem] leading-4 text-[var(--text-muted)]">{card.detail}</p>
            </div>
          </div>
        </DashboardCard>
      ))}
    </div>
  )
}
