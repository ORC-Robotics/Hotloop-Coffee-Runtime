import { useEffect, useState } from 'react'
import { cn } from '../../../lib/cn'
import { useSpatialTelemetry } from '../../../hooks/useSpatialTelemetry'
import { useSpatialViewModel } from '../../../hooks/useSpatialViewModel'
import { useGuidedNavigation } from '../../../hooks/useGuidedNavigation'
import type { HomeWorkspacePresetWidget } from '../../../home-workspace/homeWorkspaceStore'
import { PlanarViewerCanvas } from '../../spatial/PlanarViewerCanvas'

function normalizeHeadingDegrees(value: number) {
  let normalized = value

  while (normalized > 180) {
    normalized -= 360
  }

  while (normalized < -180) {
    normalized += 360
  }

  return normalized
}

function YawButton({
  label,
  active = false,
  onClick,
}: {
  label: string
  active?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-2.5 py-1.5 text-[0.62rem] font-semibold uppercase tracking-[0.14em] transition-colors',
        active
          ? 'border-[var(--accent)] bg-[var(--accent-soft)]/84 text-[var(--text)]'
          : 'border-[var(--border)] bg-[var(--surface-alt)]/82 text-[var(--text-muted)] hover:bg-[var(--surface)] hover:text-[var(--text)]',
      )}
    >
      {label}
    </button>
  )
}

export function HomeWorkspaceSpatialViewWidget({
  widget,
  onUpdateWidget,
}: {
  widget: HomeWorkspacePresetWidget
  onUpdateWidget: (widgetId: string, patch: { presetConfig?: { spatialTargetYawDeg?: number | null } }) => void
}) {
  const snapshot = useSpatialTelemetry()
  const targetYawDeg = widget.config.spatialTargetYawDeg
  const [yawDraft, setYawDraft] = useState(
    targetYawDeg === null ? '' : String(Math.round(targetYawDeg)),
  )
  const viewModel = useSpatialViewModel(snapshot, {
    goalTargetYawDeg: targetYawDeg,
  })
  const guidedNavigation = useGuidedNavigation({
    goalPreview: viewModel.goalPreview,
    selectedPose: viewModel.selectedPose,
    lidarDiagnostics: viewModel.lidarDiagnostics,
  })

  useEffect(() => {
    setYawDraft(targetYawDeg === null ? '' : String(Math.round(targetYawDeg)))
  }, [targetYawDeg])

  const setTargetYaw = (value: number | null) => {
    onUpdateWidget(widget.id, {
      presetConfig: {
        spatialTargetYawDeg: value === null ? null : normalizeHeadingDegrees(value),
      },
    })
  }

  const applyYawDraft = () => {
    if (!yawDraft.trim()) {
      setTargetYaw(null)
      return
    }

    const parsed = Number(yawDraft)
    if (!Number.isFinite(parsed)) {
      setYawDraft(targetYawDeg === null ? '' : String(Math.round(targetYawDeg)))
      return
    }

    setTargetYaw(parsed)
  }

  const seedYawDeg =
    targetYawDeg ??
    (viewModel.selectedPose.isRenderable ? viewModel.selectedPose.pose.yawDeg : 0)

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2 rounded-[16px] border border-[var(--border)] bg-[var(--surface)]/78 px-2.5 py-2">
        <div className="mr-1 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
          Target Yaw
        </div>

        <YawButton label="Auto" active={targetYawDeg === null} onClick={() => setTargetYaw(null)} />
        <YawButton
          label="Use Pose"
          onClick={() =>
            viewModel.selectedPose.isRenderable
              ? setTargetYaw(viewModel.selectedPose.pose.yawDeg)
              : undefined
          }
        />
        <YawButton label="-45" onClick={() => setTargetYaw(seedYawDeg - 45)} />

        <input
          type="number"
          step={5}
          value={yawDraft}
          onChange={(event) => setYawDraft(event.target.value)}
          onBlur={applyYawDraft}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.currentTarget.blur()
            }
          }}
          placeholder="deg"
          className="w-[78px] rounded-full border border-[var(--border)] bg-[var(--surface-alt)]/82 px-3 py-1.5 text-center text-[0.74rem] font-mono text-[var(--text)] outline-none transition-colors focus:border-[var(--accent)]"
        />

        <YawButton label="+45" onClick={() => setTargetYaw(seedYawDeg + 45)} />

        <div className="ml-auto rounded-full border border-[var(--border)] bg-[var(--surface-alt)]/72 px-3 py-1.5 text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
          {targetYawDeg === null ? 'Path Auto' : `Goal ${Math.round(targetYawDeg)} deg`}
        </div>
      </div>

      <div className="min-h-0 flex-1">
        <PlanarViewerCanvas
          poseSelection={viewModel.selectedPose}
          lidarSelection={viewModel.selectedLidar}
          scanRegistration={viewModel.scanRegistration}
          poseTransition={viewModel.poseTransition}
          trail={viewModel.displayTrail}
          lidarHistory={viewModel.displayLidarHistory}
          observedMapScans={viewModel.displayObservedMapScans}
          observedMapFadeOlderScans={viewModel.observedMapFadeOlderScans}
          observedMapFrozen={viewModel.observedMapFrozen}
          occupancyLayer={viewModel.occupancyLayer}
          showOccupancyLayer={viewModel.showOccupancyLayer}
          occupancyDisplayMode={viewModel.occupancyDisplayMode}
          goalPreview={viewModel.goalPreview}
          guidedNavigation={guidedNavigation}
          replaySelection={viewModel.replaySelection}
          viewport={viewModel.viewport}
          followRobot={viewModel.followRobot}
          onPanViewport={viewModel.panViewport}
          onZoomViewport={viewModel.zoomViewport}
          onRotateViewport={viewModel.rotateViewport}
          onToggleFollowRobot={viewModel.toggleFollowRobot}
          onCenterRobot={viewModel.centerOnRobot}
          onResetView={viewModel.resetView}
          onClearTrail={viewModel.clearTrail}
          onClearLidarHistory={viewModel.clearLidarHistory}
          onClearObservedMap={viewModel.clearObservedMap}
          onToggleObservedMapFrozen={viewModel.toggleObservedMapFrozen}
          onToggleOccupancyLayer={viewModel.toggleOccupancyLayer}
          onSelectGoalAtWorldPoint={viewModel.selectGoalAtWorldPoint}
          onArmGoalPreview={viewModel.armGoalPreview}
          onDisarmGoalPreview={viewModel.disarmGoalPreview}
          onClearGoalPreview={viewModel.clearGoalPreview}
          variant="widget"
          requireCtrlForInteraction
        />
      </div>
    </div>
  )
}
