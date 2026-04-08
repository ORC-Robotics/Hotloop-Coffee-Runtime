import { CameraViewportPanel } from './CameraViewportPanel'

export function CameraWallWorkspace() {
  return (
    <div className="grid gap-3">
      <CameraViewportPanel
        title="Camera Wall"
        subtitle="larger live viewport surface for robot vision and driver checks"
      />
    </div>
  )
}
