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
import { HomeWorkspaceShell } from '../components/dashboard/HomeWorkspaceShell'
import { NetworkPanel } from '../components/dashboard/NetworkPanel'
import { OverviewCards } from '../components/dashboard/OverviewCards'
import { OverviewOperatorRail } from '../components/dashboard/OverviewOperatorRail'
import { PerceptionPanel } from '../components/dashboard/PerceptionPanel'
import { ReactiveStatePanel } from '../components/dashboard/ReactiveStatePanel'
import { RemoteDriverWorkspace } from '../components/dashboard/RemoteDriverWorkspace'
import {
  SecondaryWorkspaceBar,
  type SecondaryWorkspaceId,
} from '../components/dashboard/SecondaryWorkspaceBar'
import { StatusBadge } from '../components/dashboard/StatusBadge'
import { SystemsHealthPanel } from '../components/dashboard/SystemsHealthPanel'
import { TelemetryModeToggle } from '../components/dashboard/TelemetryModeToggle'
import { useDashboardPreferences } from '../preferences/useDashboardPreferences'
import { useTelemetryMode } from '../telemetry-mode/useTelemetryMode'
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

export default function App() {
  const { snapshot, alerts, derived, batteryHistory } = useTelemetry()
  const { controlMode, bridgeStatus, selectedModeId, setSelectedModeId, applyRequestedMode } =
    useControlMode()
  const { preferences, activeCameraFeeds } = useDashboardPreferences()
  const { mode } = useTelemetryMode()
  const [activeTab, setActiveTab] = useState<DashboardTabId>('overview')
  const [secondaryBarOpen, setSecondaryBarOpen] = useState(false)
  const [activeWorkspace, setActiveWorkspace] = useState<SecondaryWorkspaceId | null>(null)
  const hasConfiguredCameraFeeds = activeCameraFeeds.length > 0
  const homeSurfaceActive = activeTab === 'overview' && activeWorkspace === null

  const overviewMain = (
    <div className="grid min-h-0 gap-3 xl:grid-cols-[minmax(0,1fr)_320px] 2xl:grid-cols-[minmax(0,1fr)_336px]">
      <div className="min-h-0">
        <HomeWorkspaceShell />
      </div>
      <OverviewOperatorRail active={homeSurfaceActive} />
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
      <div className="grid gap-3 xl:grid-cols-12">
        <div className="grid gap-3 xl:col-span-4">
          <HeadingPanel data={snapshot.heading} tone={derived.alignmentTone} />
          <CommandsPanel data={snapshot.commands} derived={derived} />
          {diagnosticsMetricsCard}
        </div>
        <div className="xl:col-span-8">
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
        <div className="xl:col-span-7">
          <PerceptionPanel data={snapshot.perception} />
        </div>
        <div className="grid gap-3 xl:col-span-5">
          <EncodersPanel data={snapshot.encoders} />
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
    ) : (
      <div className="grid gap-3 xl:grid-cols-12">
        <div className="grid gap-3 xl:col-span-4">
          <HeadingPanel data={snapshot.heading} tone={derived.alignmentTone} />
          <CommandsPanel data={snapshot.commands} derived={derived} />
        </div>
        <div className="xl:col-span-8">
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
        <div className="xl:col-span-7">
          <PerceptionPanel data={snapshot.perception} />
        </div>
        <div className="grid gap-3 xl:col-span-5">
          <EncodersPanel data={snapshot.encoders} />
          <ControlModePanel
            controlMode={controlMode}
            selectedModeId={selectedModeId}
            onSelectMode={setSelectedModeId}
            onApplyMode={applyRequestedMode}
            connection={snapshot.connection}
            bridgeStatus={bridgeStatus}
          />
          {diagnosticsMetricsCard}
        </div>
      </div>
    )

  const systemsPanels = (
    <>
      <AlertsPanel alerts={alerts} />
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
          controls={
            <>
              <TelemetryModeToggle />
              <DashboardSettingsLauncher />
            </>
          }
          extraBadges={
            <>
              <StatusBadge tone={mode === 'online' ? 'good' : 'warning'} label={mode === 'online' ? 'online mode' : 'simulation'} />
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
          {secondaryBarOpen || activeWorkspace ? (
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
          ) : (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setSecondaryBarOpen(true)}
                className="rounded-full border border-[var(--border)] bg-[var(--surface-alt)]/78 px-4 py-2 text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text)]"
              >
                Open workspaces
              </button>
            </div>
          )}
        </div>
      }
      main={main}
    />
  )
}
