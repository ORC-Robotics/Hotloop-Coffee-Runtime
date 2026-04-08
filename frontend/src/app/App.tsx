import { useState } from 'react'
import { AlertsPanel } from '../components/dashboard/AlertsPanel'
import { BatteryPanel } from '../components/dashboard/BatteryPanel'
import { CameraViewportPanel } from '../components/dashboard/CameraViewportPanel'
import { CameraWallWorkspace } from '../components/dashboard/CameraWallWorkspace'
import { CommandsPanel } from '../components/dashboard/CommandsPanel'
import { ControlModePanel } from '../components/dashboard/ControlModePanel'
import { CustomTelemetryWorkspace } from '../components/dashboard/CustomTelemetryWorkspace'
import { DashboardCard } from '../components/dashboard/DashboardCard'
import { DashboardSettingsLauncher } from '../components/dashboard/DashboardSettingsLauncher'
import { DashboardTabs, type DashboardTabId } from '../components/dashboard/DashboardTabs'
import { EncodersPanel } from '../components/dashboard/EncodersPanel'
import { HeadingPanel } from '../components/dashboard/HeadingPanel'
import { NetworkPanel } from '../components/dashboard/NetworkPanel'
import { OverviewCards } from '../components/dashboard/OverviewCards'
import { PerceptionPanel } from '../components/dashboard/PerceptionPanel'
import { ReactiveStatePanel } from '../components/dashboard/ReactiveStatePanel'
import { RemoteDriverWorkspace } from '../components/dashboard/RemoteDriverWorkspace'
import {
  SecondaryWorkspaceBar,
  type SecondaryWorkspaceId,
} from '../components/dashboard/SecondaryWorkspaceBar'
import { StatusBadge } from '../components/dashboard/StatusBadge'
import { SystemsHealthPanel } from '../components/dashboard/SystemsHealthPanel'
import { useDashboardPreferences } from '../preferences/useDashboardPreferences'
import { TopStatusBar } from '../components/dashboard/TopStatusBar'
import { useControlMode } from '../hooks/useControlMode'
import { useTelemetry } from '../hooks/useTelemetry'
import { DashboardLayout } from './layout/DashboardLayout'

function controlSyncTone(status: ReturnType<typeof useControlMode>['controlMode']['syncStatus']) {
  if (status === 'synced' || status === 'applied') return 'good'
  if (status === 'pending' || status === 'stale') return 'warning'
  if (status === 'rejected' || status === 'unavailable') return 'critical'
  return 'neutral'
}

function sensorChainTone(snapshot: ReturnType<typeof useTelemetry>['snapshot']) {
  if (snapshot.systems.lidarHealthy && snapshot.systems.validScan && snapshot.systems.navxConnected) {
    return 'good'
  }
  if (snapshot.systems.lidarHealthy || snapshot.systems.validScan || snapshot.systems.navxConnected) {
    return 'warning'
  }
  return 'critical'
}

const overviewShellLayouts = {
  balanced: 'xl:grid-cols-[minmax(290px,22fr)_minmax(0,56fr)_minmax(300px,22fr)]',
  pilot: 'xl:grid-cols-[minmax(270px,18fr)_minmax(0,62fr)_minmax(300px,20fr)]',
  dataWall: 'xl:grid-cols-[minmax(320px,26fr)_minmax(0,48fr)_minmax(320px,26fr)]',
} as const

const overviewLeftLayouts = {
  balanced: 'xl:grid-rows-[minmax(0,1.2fr)_minmax(0,0.8fr)]',
  pilot: 'xl:grid-rows-[minmax(0,1fr)_minmax(0,0.9fr)]',
  dataWall: 'xl:grid-rows-[minmax(0,1fr)_minmax(0,1fr)]',
} as const

const overviewCenterLayouts = {
  balanced: 'xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]',
  pilot: 'xl:grid-cols-[minmax(0,1.22fr)_minmax(0,0.78fr)]',
  dataWall: 'xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]',
} as const

const overviewRightLayouts = {
  balanced: 'xl:grid-rows-[minmax(0,0.82fr)_minmax(0,1.18fr)]',
  pilot: 'xl:grid-rows-[minmax(0,0.7fr)_minmax(0,1.3fr)]',
  dataWall: 'xl:grid-rows-[minmax(0,1fr)_minmax(0,1fr)]',
} as const

export default function App() {
  const { snapshot, alerts, derived, batteryHistory } = useTelemetry()
  const { controlMode, bridgeStatus, selectedModeId, setSelectedModeId, applyRequestedMode } =
    useControlMode()
  const { preferences, activeCameraFeeds } = useDashboardPreferences()
  const [activeTab, setActiveTab] = useState<DashboardTabId>('overview')
  const [secondaryBarOpen, setSecondaryBarOpen] = useState(false)
  const [activeWorkspace, setActiveWorkspace] = useState<SecondaryWorkspaceId | null>(null)
  const hasConfiguredCameraFeeds = activeCameraFeeds.length > 0

  const overviewMain = (
    <div className={`grid gap-3 ${overviewShellLayouts[preferences.layout.overviewLayout]}`}>
      <div className={`grid min-h-0 gap-3 ${overviewLeftLayouts[preferences.layout.overviewLayout]}`}>
        <HeadingPanel data={snapshot.heading} tone={derived.alignmentTone} />
        <CommandsPanel data={snapshot.commands} derived={derived} />
      </div>

      <div className={`grid min-h-0 gap-3 ${overviewCenterLayouts[preferences.layout.overviewLayout]}`}>
        <PerceptionPanel data={snapshot.perception} />
        <ReactiveStatePanel
          online={snapshot.connection.online}
          heading={snapshot.heading}
          perception={snapshot.perception}
          commands={snapshot.commands}
          systems={snapshot.systems}
          data={snapshot.reactive}
          derived={derived}
        />
      </div>

      <div className={`grid min-h-0 gap-3 ${overviewRightLayouts[preferences.layout.overviewLayout]}`}>
        <AlertsPanel alerts={alerts} />
        <ControlModePanel
          controlMode={controlMode}
          selectedModeId={selectedModeId}
          onSelectMode={setSelectedModeId}
          onApplyMode={applyRequestedMode}
          connection={snapshot.connection}
          bridgeStatus={bridgeStatus}
        />
      </div>
    </div>
  )

  const diagnosticsMetricsCard = (
    <DashboardCard title="Secondary Metrics" subtitle="auxiliary counters" accent="info" className="min-h-[0]">
      <div className="grid gap-2">
        {[
          ['Angular Error', `${snapshot.heading.angularErrorDeg.toFixed(1)} deg`],
          ['Lateral Error', `${snapshot.heading.lateralErrorM.toFixed(2)} m`],
          ['Stable Scans', String(snapshot.reactive.stableScans)],
          ['State Time', `${snapshot.reactive.stateTimeSec.toFixed(1)} s`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-[16px] border border-[var(--border)] bg-[var(--surface-alt)]/82 px-3 py-2.5">
            <div className="text-[0.64rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">{label}</div>
            <div className="mt-1.5 font-mono text-[0.86rem] text-[var(--text)]">{value}</div>
          </div>
        ))}
      </div>
    </DashboardCard>
  )

  const diagnosticsMain =
    preferences.layout.diagnosticsLayout === 'deepDive' ? (
      <div className="grid gap-3">
        <EncodersPanel data={snapshot.encoders} />
        {diagnosticsMetricsCard}
      </div>
    ) : (
      <div className="grid gap-3 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <EncodersPanel data={snapshot.encoders} />
        </div>
        <div className="xl:col-span-4">{diagnosticsMetricsCard}</div>
      </div>
    )

  const systemsPanels = (
    <>
      {preferences.layout.showCameraInSystems && hasConfiguredCameraFeeds ? (
        <CameraViewportPanel title="Systems Camera" subtitle="live robot viewport pinned into the systems page" compact />
      ) : null}
      <BatteryPanel battery={snapshot.battery} history={batteryHistory} />
      <NetworkPanel
        data={snapshot.connection}
        tone={derived.connectionTone}
        bridgeStatus={bridgeStatus}
        controlMode={controlMode}
      />
    </>
  )

  const systemsMain =
    preferences.layout.systemsLayout === 'stacked' ? (
      <div className="grid gap-3">
        <SystemsHealthPanel data={snapshot.systems} overallTone={derived.robotHealthTone} />
        {systemsPanels}
      </div>
    ) : preferences.layout.systemsLayout === 'cameraFocus' && hasConfiguredCameraFeeds ? (
      <div className="grid gap-3 xl:grid-cols-12">
        <div className="grid gap-3 xl:col-span-7">
          <CameraViewportPanel title="Vision Surface" subtitle="camera-forward systems layout for live field checks" />
        </div>
        <div className="grid gap-3 xl:col-span-5">
          <SystemsHealthPanel data={snapshot.systems} overallTone={derived.robotHealthTone} />
          <BatteryPanel battery={snapshot.battery} history={batteryHistory} />
          <NetworkPanel
            data={snapshot.connection}
            tone={derived.connectionTone}
            bridgeStatus={bridgeStatus}
            controlMode={controlMode}
          />
        </div>
      </div>
    ) : (
      <div className="grid gap-3 xl:grid-cols-12">
        <div className="xl:col-span-4">
          <SystemsHealthPanel data={snapshot.systems} overallTone={derived.robotHealthTone} />
        </div>
        <div className={`grid gap-3 xl:col-span-8 ${preferences.layout.showCameraInSystems && hasConfiguredCameraFeeds ? 'xl:grid-rows-[minmax(0,1.06fr)_minmax(0,1fr)_minmax(0,1fr)]' : 'xl:grid-rows-[minmax(0,1fr)_minmax(0,1fr)]'}`}>
          {systemsPanels}
        </div>
      </div>
    )

  const debugMain = (
    <div className="grid gap-3 xl:grid-cols-12">
      <div className="xl:col-span-6">
        <DashboardCard
          title="Debug Workspace"
          subtitle="reserved for future tooling"
          accent="accent"
          className="min-h-[220px]"
        >
          <div className="rounded-[18px] border border-dashed border-[var(--border)] bg-[var(--surface-alt)]/75 px-4 py-4 text-[0.84rem] leading-6 text-[var(--text-muted)]">
            Reserve this tab for raw topic inspection, planner traces, telemetry latency analysis and future backend bridge diagnostics.
          </div>
        </DashboardCard>
      </div>
      <div className="xl:col-span-6">
        <DashboardCard title="Panel Roadmap" subtitle="next additions" accent="info" className="min-h-[220px]">
          <div className="grid gap-2.5">
            {[
              'Backend websocket bridge status',
              'Raw NetworkTables key inspector',
              'Telemetry recording controls',
              'Reactive planner tuning surfaces',
            ].map((item) => (
              <div
                key={item}
                className="rounded-[18px] border border-[var(--border)] bg-[var(--surface-alt)]/80 px-3.5 py-3 text-[0.84rem] text-[var(--text)]"
              >
                {item}
              </div>
            ))}
          </div>
        </DashboardCard>
      </div>
    </div>
  )

  const primaryMain =
    activeTab === 'overview'
      ? overviewMain
      : activeTab === 'diagnostics'
        ? diagnosticsMain
        : activeTab === 'systems'
          ? systemsMain
          : debugMain

  const main =
    activeWorkspace === 'custom-telemetry'
      ? <CustomTelemetryWorkspace />
      : activeWorkspace === 'camera-wall'
        ? <CameraWallWorkspace />
      : activeWorkspace === 'remote-driver'
        ? <RemoteDriverWorkspace active />
        : primaryMain

  return (
    <DashboardLayout
      topBar={
        <TopStatusBar
          connection={snapshot.connection}
          timestamp={snapshot.timestamp}
          lastUpdatedLabel={derived.lastUpdatedLabel}
          scenarioLabel={snapshot.scenarioLabel}
          statusTone={derived.connectionTone}
          controls={<DashboardSettingsLauncher />}
          extraBadges={
            <>
              <StatusBadge tone={sensorChainTone(snapshot)} label="sensor chain" />
              <StatusBadge tone={controlSyncTone(controlMode.syncStatus)} label={`automode ${controlMode.syncStatus}`} />
            </>
          }
        />
      }
      overview={<OverviewCards snapshot={snapshot} derived={derived} layoutMode={preferences.layout.overviewLayout} />}
      tabBar={
        <div className="grid gap-3">
          <DashboardTabs
            activeTab={activeTab}
            onChange={(tab) => {
              setActiveTab(tab)
              setActiveWorkspace(null)
            }}
          />
          <SecondaryWorkspaceBar
            open={secondaryBarOpen}
            activeWorkspace={activeWorkspace}
            onToggle={() => setSecondaryBarOpen((current) => !current)}
            onSelectWorkspace={(workspace) => {
              setSecondaryBarOpen(true)
              setActiveWorkspace(workspace)
            }}
            onCloseWorkspace={() => setActiveWorkspace(null)}
          />
        </div>
      }
      main={main}
    />
  )
}
