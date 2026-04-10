import { startTransition, useEffect, useRef, useState } from 'react'
import {
  getRemoteDriverStatus,
  sendRemoteDriverAction,
  sendRemoteDriverState,
} from '../data/telemetryGateway'
import { useTelemetryMode } from '../telemetry-mode/useTelemetryMode'
import type {
  BridgeStatus,
  RemoteDriverAction,
  RemoteDriverStatus,
} from '../types/telemetry'

const STATUS_POLL_MS = 320
const PREVIEW_POLL_MS = 80
const DRIVER_SOURCE = 'ORION Desktop'
const INPUT_DEADBAND = 0.08

type DriverPreview = {
  gamepadConnected: boolean
  gamepadLabel: string
  inputSource: string
  x: number
  y: number
  z: number
}

type CommandState = {
  tone: 'neutral' | 'warning' | 'good' | 'critical'
  message: string
}

type KeyboardState = {
  left: boolean
  right: boolean
  forward: boolean
  reverse: boolean
  rotateLeft: boolean
  rotateRight: boolean
}

type PanelDriveState = {
  x: number
  y: number
  z: number
  active: boolean
}

type InputSample = DriverPreview

function clampUnit(value: number) {
  return Math.max(-1, Math.min(1, value))
}

function applyDeadband(value: number) {
  const clamped = clampUnit(value)
  return Math.abs(clamped) < INPUT_DEADBAND ? 0 : clamped
}

function createFallbackRemoteDriver(): RemoteDriverStatus {
  return {
    active: false,
    mode: 'disabled',
    heartbeatFresh: false,
    heartbeatAgeSec: null,
    source: 'ORION',
    inputSource: 'idle',
    lastAction: 'none',
    driveX: 0,
    driveY: 0,
    driveZ: 0,
    gyroAssist: true,
    robotEnabled: false,
    status: 'Remote driver unavailable.',
  }
}

function createFallbackBridgeStatus(): BridgeStatus {
  return {
    transport: 'networktables',
    chooserPath: 'SmartDashboard/Auto mode',
    telemetryEndpoint: '/api/telemetry',
    controlModeEndpoint: '/api/control-mode',
    topicCatalogEndpoint: '/api/topics',
    topicWriteEndpoint: '/api/topics/write',
    remoteDriverEndpoint: '/api/remote-driver',
    connected: false,
    message: 'Waiting for bridge.',
  }
}

function createIdlePreview(): DriverPreview {
  return {
    gamepadConnected: false,
    gamepadLabel: 'No controller detected',
    inputSource: 'idle',
    x: 0,
    y: 0,
    z: 0,
  }
}

function createEmptyKeyboardState(): KeyboardState {
  return {
    left: false,
    right: false,
    forward: false,
    reverse: false,
    rotateLeft: false,
    rotateRight: false,
  }
}

function createIdlePanelDriveState(): PanelDriveState {
  return {
    x: 0,
    y: 0,
    z: 0,
    active: false,
  }
}

function matchesEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'))
}

function readKeyboardAxes(state: KeyboardState) {
  const x = (state.right ? 0.72 : 0) - (state.left ? 0.72 : 0)
  const y = (state.forward ? 0.72 : 0) - (state.reverse ? 0.72 : 0)
  const z = (state.rotateRight ? 0.56 : 0) - (state.rotateLeft ? 0.56 : 0)

  return {
    x: applyDeadband(x),
    y: applyDeadband(y),
    z: applyDeadband(z),
    active: Boolean(state.left || state.right || state.forward || state.reverse || state.rotateLeft || state.rotateRight),
  }
}

function selectGamepad(preferredIndex: number | null) {
  if (!navigator.getGamepads) {
    return null
  }

  const pads = navigator.getGamepads()
  if (!pads) {
    return null
  }

  if (preferredIndex !== null) {
    const preferred = pads[preferredIndex]
    if (preferred?.connected) {
      return preferred
    }
  }

  for (const pad of pads) {
    if (pad?.connected) {
      return pad
    }
  }

  return null
}

function readGamepadAxes(gamepad: Gamepad | null) {
  if (!gamepad) {
    return {
      x: 0,
      y: 0,
      z: 0,
      active: false,
      connected: false,
      label: 'No controller detected',
      index: null as number | null,
    }
  }

  const x = applyDeadband(gamepad.axes[0] ?? 0)
  const y = applyDeadband(-(gamepad.axes[1] ?? 0))
  const z = applyDeadband(gamepad.axes[2] ?? 0)

  return {
    x,
    y,
    z,
    active: Math.abs(x) > 0 || Math.abs(y) > 0 || Math.abs(z) > 0,
    connected: true,
    label: gamepad.id || `Gamepad ${gamepad.index + 1}`,
    index: gamepad.index,
  }
}

function combineInputs(
  gamepadState: ReturnType<typeof readGamepadAxes>,
  keyboardState: ReturnType<typeof readKeyboardAxes>,
  panelState: PanelDriveState,
): InputSample {
  const activeSources: string[] = []

  if (gamepadState.active) {
    activeSources.push('gamepad')
  }
  if (keyboardState.active) {
    activeSources.push('keyboard')
  }
  if (panelState.active) {
    activeSources.push('panel')
  }

  const inputSource =
    activeSources.length === 0 ? 'idle' : activeSources.length === 1 ? activeSources[0] : 'hybrid'

  return {
    gamepadConnected: gamepadState.connected,
    gamepadLabel: gamepadState.label,
    inputSource,
    x: clampUnit(gamepadState.x + keyboardState.x + panelState.x),
    y: clampUnit(gamepadState.y + keyboardState.y + panelState.y),
    z: clampUnit(gamepadState.z + keyboardState.z + panelState.z),
  }
}

function createZeroPacket(gyroAssist: boolean) {
  return {
    x: 0,
    y: 0,
    z: 0,
    gyroAssist,
    source: DRIVER_SOURCE,
    inputSource: 'idle',
  }
}

export function useRemoteDriver(active: boolean) {
  const { mode } = useTelemetryMode()
  const [remoteDriver, setRemoteDriver] = useState<RemoteDriverStatus>(createFallbackRemoteDriver())
  const [bridgeStatus, setBridgeStatus] = useState<BridgeStatus>(createFallbackBridgeStatus())
  const [controlsArmed, setControlsArmed] = useState(false)
  const [gyroAssist, setGyroAssist] = useState(true)
  const [preview, setPreview] = useState<DriverPreview>(createIdlePreview())
  const [commandState, setCommandState] = useState<CommandState>({
    tone: 'neutral',
    message: 'Arm controls, then enable teleop to drive from ORION.',
  })
  const keyboardStateRef = useRef<KeyboardState>(createEmptyKeyboardState())
  const panelDriveStateRef = useRef<PanelDriveState>(createIdlePanelDriveState())
  const preferredGamepadIndexRef = useRef<number | null>(null)
  const controlsArmedRef = useRef(controlsArmed)
  const gyroAssistRef = useRef(gyroAssist)
  const wasTransmittingRef = useRef(false)

  useEffect(() => {
    controlsArmedRef.current = controlsArmed
  }, [controlsArmed])

  useEffect(() => {
    gyroAssistRef.current = gyroAssist
  }, [gyroAssist])

  useEffect(() => {
    if (!active) {
      if (wasTransmittingRef.current) {
        void sendRemoteDriverState(createZeroPacket(gyroAssistRef.current))
      }
      wasTransmittingRef.current = false
      setControlsArmed(false)
      keyboardStateRef.current = createEmptyKeyboardState()
      panelDriveStateRef.current = createIdlePanelDriveState()
      setPreview(createIdlePreview())
      return
    }

    let cancelled = false

    const syncStatus = async () => {
      try {
        const response = await getRemoteDriverStatus()
        if (cancelled) {
          return
        }

        setRemoteDriver(response.remoteDriver)
        if (response.bridgeStatus) {
          setBridgeStatus(response.bridgeStatus)
        }
      } catch {
        if (cancelled) {
          return
        }

        setRemoteDriver((previous) => ({
          ...previous,
          status: previous.status || 'Unable to reach the remote driver bridge.',
        }))
      }
    }

    void syncStatus()
    const interval = window.setInterval(() => {
      void syncStatus()
    }, STATUS_POLL_MS)

    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [active, mode])

  useEffect(() => {
    if (!active) {
      return
    }

    const handleKeyChange = (event: KeyboardEvent, pressed: boolean) => {
      if (matchesEditableTarget(event.target)) {
        return
      }

      let handled = true
      const nextState = keyboardStateRef.current

      switch (event.code) {
        case 'KeyA':
        case 'ArrowLeft':
          nextState.left = pressed
          break
        case 'KeyD':
        case 'ArrowRight':
          nextState.right = pressed
          break
        case 'KeyW':
        case 'ArrowUp':
          nextState.forward = pressed
          break
        case 'KeyS':
        case 'ArrowDown':
          nextState.reverse = pressed
          break
        case 'KeyQ':
          nextState.rotateLeft = pressed
          break
        case 'KeyE':
          nextState.rotateRight = pressed
          break
        default:
          handled = false
          break
      }

      if (handled) {
        event.preventDefault()
      }
    }

    const handleBlur = () => {
      keyboardStateRef.current = createEmptyKeyboardState()
      panelDriveStateRef.current = createIdlePanelDriveState()
      setControlsArmed(false)
      setCommandState({
        tone: 'warning',
        message: 'Controls disarmed because the window lost focus.',
      })
    }

    const handleGamepadChange = () => {
      const selected = selectGamepad(preferredGamepadIndexRef.current)
      preferredGamepadIndexRef.current = selected?.index ?? null
    }

    const handleVisibility = () => {
      if (document.hidden) {
        handleBlur()
      }
    }

    const keyDown = (event: KeyboardEvent) => handleKeyChange(event, true)
    const keyUp = (event: KeyboardEvent) => handleKeyChange(event, false)

    window.addEventListener('keydown', keyDown)
    window.addEventListener('keyup', keyUp)
    window.addEventListener('blur', handleBlur)
    window.addEventListener('gamepadconnected', handleGamepadChange)
    window.addEventListener('gamepaddisconnected', handleGamepadChange)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      window.removeEventListener('keydown', keyDown)
      window.removeEventListener('keyup', keyUp)
      window.removeEventListener('blur', handleBlur)
      window.removeEventListener('gamepadconnected', handleGamepadChange)
      window.removeEventListener('gamepaddisconnected', handleGamepadChange)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [active, mode])

  useEffect(() => {
    if (!active) {
      return
    }

    let cancelled = false

    const tick = async () => {
      const selectedGamepad = selectGamepad(preferredGamepadIndexRef.current)
      const gamepadState = readGamepadAxes(selectedGamepad)
      preferredGamepadIndexRef.current = gamepadState.index
      const inputSample = combineInputs(
        gamepadState,
        readKeyboardAxes(keyboardStateRef.current),
        panelDriveStateRef.current,
      )

      startTransition(() => {
        setPreview(inputSample)
      })

      if (!controlsArmedRef.current) {
        return
      }

      try {
        const response = await sendRemoteDriverState({
          x: inputSample.x,
          y: inputSample.y,
          z: inputSample.z,
          gyroAssist: gyroAssistRef.current,
          source: DRIVER_SOURCE,
          inputSource: inputSample.inputSource,
        })

        if (cancelled) {
          return
        }

        if (response.remoteDriver) {
          setRemoteDriver(response.remoteDriver)
        }
        if (response.bridgeStatus) {
          setBridgeStatus(response.bridgeStatus)
        }
        wasTransmittingRef.current = true
      } catch {
        if (!cancelled) {
          setCommandState({
            tone: 'critical',
            message: 'Failed to stream remote driver packets to the bridge.',
          })
        }
      }
    }

    void tick()
    const interval = window.setInterval(() => {
      void tick()
    }, PREVIEW_POLL_MS)

    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [active, mode])

  useEffect(() => {
    if (controlsArmed) {
      setCommandState({
        tone: 'good',
        message: 'Remote packets are armed. Enable teleop when you are ready to move.',
      })
      return
    }

    if (!active) {
      return
    }

    const sendZeroPacket = async () => {
      if (!wasTransmittingRef.current) {
        return
      }

      try {
        const response = await sendRemoteDriverState(createZeroPacket(gyroAssistRef.current))
        if (response.remoteDriver) {
          setRemoteDriver(response.remoteDriver)
        }
        if (response.bridgeStatus) {
          setBridgeStatus(response.bridgeStatus)
        }
      } catch {
        // Keep the UI calm here; the robot will still auto-disable if the heartbeat expires.
      } finally {
        wasTransmittingRef.current = false
      }
    }

    void sendZeroPacket()
  }, [active, controlsArmed, mode])

  const dispatchAction = async (action: RemoteDriverAction) => {
    setCommandState({
      tone: 'warning',
      message: `Sending ${action.replace('_', ' ')} to the robot.`,
    })

    try {
      const response = await sendRemoteDriverAction(action, DRIVER_SOURCE)
      if (response.remoteDriver) {
        setRemoteDriver(response.remoteDriver)
      }
      if (response.bridgeStatus) {
        setBridgeStatus(response.bridgeStatus)
      }

      if (action === 'disable' || action === 'reset' || action === 'estop') {
        setControlsArmed(false)
      }

      setCommandState({
        tone: response.error ? 'critical' : 'good',
        message: response.error ?? response.message ?? 'Robot action applied.',
      })
    } catch {
      setCommandState({
        tone: 'critical',
        message: 'The remote driver action did not reach the bridge.',
      })
    }
  }

  const setPanelDriveState = (next: Omit<PanelDriveState, 'active'> | null) => {
    panelDriveStateRef.current = next
      ? {
          x: applyDeadband(next.x),
          y: applyDeadband(next.y),
          z: applyDeadband(next.z),
          active: Math.abs(next.x) > 0 || Math.abs(next.y) > 0 || Math.abs(next.z) > 0,
        }
      : createIdlePanelDriveState()
  }

  return {
    remoteDriver,
    bridgeStatus,
    controlsArmed,
    setControlsArmed,
    gyroAssist,
    setGyroAssist,
    preview,
    commandState,
    dispatchAction,
    setPanelDriveState,
  }
}
