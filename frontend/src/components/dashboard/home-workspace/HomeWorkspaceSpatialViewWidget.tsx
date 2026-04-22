import { useSpatialTelemetry } from '../../../hooks/useSpatialTelemetry'
import { useSpatialViewModel } from '../../../hooks/useSpatialViewModel'
import { useGuidedNavigation } from '../../../hooks/useGuidedNavigation'
import { PlanarViewerCanvas } from '../../spatial/PlanarViewerCanvas'

export function HomeWorkspaceSpatialViewWidget() {
  const snapshot = useSpatialTelemetry()
  const viewModel = useSpatialViewModel(snapshot)
  const guidedNavigation = useGuidedNavigation({
    goalPreview: viewModel.goalPreview,
    selectedPose: viewModel.selectedPose,
    lidarDiagnostics: viewModel.lidarDiagnostics,
  })

  return (
    <div className="h-full min-h-0">
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
  )
}
