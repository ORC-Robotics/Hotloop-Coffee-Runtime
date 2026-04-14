import { cn } from '../../lib/cn'
import { formatDegrees, formatMeters } from '../../lib/format'
import {
  formatPoseAgeLabel,
  poseSourceLabel,
  SPATIAL_POSE_OVERRIDE_OPTIONS,
} from '../../lib/spatialTelemetry'
import { useSpatialViewModel } from '../../hooks/useSpatialViewModel'
import type {
  PlanarPoseData,
  PlanarPoseFreshness,
  PoseSourceOverride,
  TelemetrySnapshot,
} from '../../types/telemetry'
import { DashboardCard } from './DashboardCard'
import { StatusBadge } from './StatusBadge'
import { PlanarViewerCanvas } from '../spatial/PlanarViewerCanvas'

interface SpatialWorkspaceProps {
  snapshot: TelemetrySnapshot
}

function freshnessTone(freshness: PlanarPoseFreshness) {
  if (freshness === 'live') return 'good'
  if (freshness === 'stale') return 'warning'
  return 'critical'
}

function availabilityTone(pose: PlanarPoseData) {
  if (pose.available && pose.freshness === 'live') return 'good'
  if (pose.available && pose.freshness === 'stale') return 'warning'
  return 'critical'
}

function formatPoseTimestamp(timestampMs: number) {
  if (timestampMs <= 0) {
    return '--'
  }

  return new Date(timestampMs).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function MetricTile({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface-alt)]/78 px-3.5 py-3">
      <div className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
        {label}
      </div>
      <div className="mt-2 font-mono text-[1rem] text-[var(--text)]">{value}</div>
    </div>
  )
}

function MetadataRow({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[16px] border border-[var(--border)] bg-[var(--surface-alt)]/68 px-3 py-2.5">
      <span className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
        {label}
      </span>
      <span className="font-mono text-[0.82rem] text-[var(--text)]">{value}</span>
    </div>
  )
}

function OverrideButton({
  label,
  description,
  active,
  onClick,
}: {
  label: string
  description: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-[18px] border px-3.5 py-3 text-left transition-colors',
        active
          ? 'border-[var(--accent)] bg-[var(--accent-soft)]/84 text-[var(--text)]'
          : 'border-[var(--border)] bg-[var(--surface-alt)]/78 text-[var(--text-muted)] hover:bg-[var(--surface-alt)]',
      )}
    >
      <div className="text-[0.74rem] font-semibold uppercase tracking-[0.16em]">{label}</div>
      <div className="mt-1 text-[0.76rem] leading-5 opacity-90">{description}</div>
    </button>
  )
}

function SourceInventoryRow({
  sourceId,
  pose,
  activeOverride,
}: {
  sourceId: Exclude<PoseSourceOverride, 'auto'>
  pose: PlanarPoseData
  activeOverride: PoseSourceOverride
}) {
  return (
    <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface-alt)]/72 px-3.5 py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[0.76rem] font-semibold uppercase tracking-[0.16em] text-[var(--text)]">
            {poseSourceLabel(sourceId)}
          </div>
          <div className="mt-1 text-[0.74rem] text-[var(--text-muted)]">{pose.frame}</div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {activeOverride === sourceId ? <StatusBadge tone="info" label="selected" /> : null}
          <StatusBadge tone={availabilityTone(pose)} label={pose.freshness} />
        </div>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <MetadataRow label="X" value={pose.available ? formatMeters(pose.xMm / 1000, 3) : '--'} />
        <MetadataRow label="Y" value={pose.available ? formatMeters(pose.yMm / 1000, 3) : '--'} />
      </div>

      <div className="mt-2 grid gap-2 md:grid-cols-2">
        <MetadataRow label="Yaw" value={pose.available ? formatDegrees(pose.yawDeg, 1) : '--'} />
        <MetadataRow label="Seq" value={pose.available ? String(pose.sequence) : '--'} />
      </div>
    </div>
  )
}

export function SpatialWorkspace({ snapshot }: SpatialWorkspaceProps) {
  const viewModel = useSpatialViewModel(snapshot)
  const pose = viewModel.selectedPose.pose
  const poseUnavailable = !viewModel.selectedPose.isRenderable

  return (
    <div className="grid min-h-0 gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
      <DashboardCard
        title="Spatial Viewer"
        subtitle="2D odometry validation surface"
        accent="accent"
        className="min-h-[640px]"
        bodyClassName="p-0"
      >
        <PlanarViewerCanvas
          poseSelection={viewModel.selectedPose}
          poseTransition={viewModel.poseTransition}
          trail={viewModel.trail}
          viewport={viewModel.viewport}
          onPanViewport={viewModel.panViewport}
          onZoomViewport={viewModel.zoomViewport}
          onCenterRobot={viewModel.centerOnRobot}
          onResetView={viewModel.resetView}
          onClearTrail={viewModel.clearTrail}
        />
      </DashboardCard>

      <div className="grid gap-3">
        <DashboardCard title="Source Selection" subtitle="pose override and selection" accent="info">
          <div className="grid gap-2">
            {SPATIAL_POSE_OVERRIDE_OPTIONS.map((option) => (
              <OverrideButton
                key={option.id}
                label={option.label}
                description={option.description}
                active={viewModel.sourceOverride === option.id}
                onClick={() => viewModel.setSourceOverride(option.id)}
              />
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <StatusBadge tone="info" label={viewModel.selectedPose.selectedSourceLabel} />
            <StatusBadge tone={freshnessTone(pose.freshness)} label={pose.freshness} />
          </div>

          <div className="mt-4 rounded-[18px] border border-[var(--border)] bg-[var(--surface-alt)]/72 px-3.5 py-3 text-[0.8rem] leading-6 text-[var(--text-muted)]">
            Auto mode prefers <span className="font-semibold text-[var(--text)]">odometry</span>, then reactive, then mapeamento. This V1 view is intentionally decoupled from robot-side mapping and ready for a future desktop-side spatial stream.
          </div>
        </DashboardCard>

        <DashboardCard title="Pose Readout" subtitle="selected source metadata" accent="primary">
          {poseUnavailable ? (
            <div className="rounded-[18px] border border-dashed border-[var(--border)] bg-[var(--surface-alt)]/66 px-4 py-4 text-[0.82rem] leading-6 text-[var(--text-muted)]">
              No valid pose is available from the selected source. Use Auto or switch to a source that is currently publishing planar SE(2) data.
            </div>
          ) : (
            <>
              <div className="grid gap-2 md:grid-cols-3">
                <MetricTile label="X" value={formatMeters(pose.xMm / 1000, 3)} />
                <MetricTile label="Y" value={formatMeters(pose.yMm / 1000, 3)} />
                <MetricTile label="Yaw" value={formatDegrees(pose.yawDeg, 1)} />
              </div>

              <div className="mt-4 grid gap-2">
                <MetadataRow label="Source" value={poseSourceLabel(pose.source)} />
                <MetadataRow label="Frame" value={pose.frame} />
                <MetadataRow label="Freshness" value={pose.freshness} />
                <MetadataRow label="Sequence" value={String(pose.sequence)} />
                <MetadataRow label="Sample Age" value={formatPoseAgeLabel(viewModel.selectedPose.ageMs)} />
                <MetadataRow label="Timestamp" value={formatPoseTimestamp(pose.timestampMs)} />
              </div>
            </>
          )}
        </DashboardCard>

        <DashboardCard title="Source Inventory" subtitle="candidate pose feeds" accent="warning">
          <div className="grid gap-2.5">
            {(['odometry', 'reactive', 'mapeamento', 'simulation'] as const).map((sourceId) => (
              <SourceInventoryRow
                key={sourceId}
                sourceId={sourceId}
                pose={viewModel.sourceStates[sourceId]}
                activeOverride={viewModel.sourceOverride}
              />
            ))}
          </div>
        </DashboardCard>
      </div>
    </div>
  )
}
