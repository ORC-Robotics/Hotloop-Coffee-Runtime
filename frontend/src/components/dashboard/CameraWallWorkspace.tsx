import type { ResolvedCameraFeed } from '../../lib/cameraFeeds'
import { CameraViewportPanel } from './CameraViewportPanel'

export function CameraWallWorkspace({ feeds }: { feeds: ResolvedCameraFeed[] }) {
  return (
    <div className="grid gap-3">
      <CameraViewportPanel
        feeds={feeds}
        title="Camera Wall"
        subtitle="larger live viewport surface for robot vision and driver checks"
      />
    </div>
  )
}
