from __future__ import annotations

import argparse
import json
from datetime import datetime, timedelta, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

from nt_client import NTClient, load_team_number


AUTO_MODE_CHOOSER_PATH = "Auto mode"
APPLIED_STATUS_HOLD = timedelta(seconds=2)
PENDING_TIMEOUT = timedelta(seconds=5)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def iso_now() -> str:
    return utc_now().isoformat()


class ControlModeManager:
    def __init__(self, client: NTClient):
        self.client = client
        self.available_modes: list[str] = []
        self.current_mode_id: str | None = None
        self.requested_mode_id: str | None = None
        self.sync_status = "unavailable"
        self.last_sync_at: str | None = None
        self.last_command_at: str | None = None
        self.message = "Auto mode chooser unavailable."
        self._pending_mode_id: str | None = None
        self._pending_since: datetime | None = None
        self._applied_until: datetime | None = None

    def _read_chooser(self) -> dict[str, Any]:
        options = self.client.get_subtable_string_array(AUTO_MODE_CHOOSER_PATH, "options", [])
        active = self.client.get_subtable_string(AUTO_MODE_CHOOSER_PATH, "active", "")
        selected = self.client.get_subtable_string(AUTO_MODE_CHOOSER_PATH, "selected", "")
        default = self.client.get_subtable_string(AUTO_MODE_CHOOSER_PATH, "default", "")
        return {
            "options": [option for option in options if option],
            "active": active or None,
            "selected": selected or None,
            "default": default or None,
        }

    def _set_status(self, status: str, message: str) -> None:
        self.sync_status = status
        self.message = message

    def refresh(self) -> dict[str, Any]:
        now = utc_now()
        online = self.client.is_connected()
        chooser = self._read_chooser() if online else {"options": [], "active": None, "selected": None, "default": None}

        if chooser["options"]:
            self.available_modes = chooser["options"]

        current_candidate = chooser["active"] or chooser["selected"] or chooser["default"]
        if current_candidate:
            self.current_mode_id = current_candidate

        if chooser["selected"]:
            self.requested_mode_id = chooser["selected"]

        chooser_available = bool(self.available_modes)

        if online and chooser_available:
            self.last_sync_at = iso_now()

            if self._pending_mode_id:
                if self.current_mode_id == self._pending_mode_id or chooser["selected"] == self._pending_mode_id:
                    self.requested_mode_id = self._pending_mode_id
                    self._pending_mode_id = None
                    self._pending_since = None
                    self._applied_until = now + APPLIED_STATUS_HOLD
                    self._set_status("applied", f"Control mode applied: {self.requested_mode_id}.")
                elif self._pending_since and now - self._pending_since > PENDING_TIMEOUT:
                    self._pending_mode_id = None
                    self._pending_since = None
                    self._set_status("stale", "Waiting for robot to confirm the requested auto mode.")
                else:
                    self._set_status("pending", f"Applying requested mode: {self._pending_mode_id}.")
            elif self._applied_until and now < self._applied_until:
                self._set_status("applied", f"Control mode applied: {self.current_mode_id or self.requested_mode_id}.")
            else:
                self._applied_until = None
                self._set_status("synced", f"Chooser synced with {AUTO_MODE_CHOOSER_PATH}.")
        elif online and not chooser_available:
            if self.last_sync_at:
                self._set_status("stale", "Robot connected, but auto mode chooser has not been published yet.")
            else:
                self._set_status("unavailable", "Auto mode chooser unavailable on SmartDashboard.")
        else:
            if self.last_sync_at:
                self._set_status("stale", "Robot link offline. Showing last known auto mode state.")
            else:
                self._set_status("unavailable", "Robot offline. Auto mode chooser unavailable.")

        return self.payload()

    def payload(self) -> dict[str, Any]:
        return {
            "availableModes": [
                {
                    "id": mode_id,
                    "label": mode_id,
                    "description": None,
                    "isAvailable": True,
                }
                for mode_id in self.available_modes
            ],
            "currentModeId": self.current_mode_id,
            "requestedModeId": self.requested_mode_id,
            "syncStatus": self.sync_status,
            "lastSyncAt": self.last_sync_at,
            "lastCommandAt": self.last_command_at,
            "message": self.message,
        }

    def request_mode_change(self, mode_id: str) -> tuple[dict[str, Any], HTTPStatus]:
        self.refresh()

        if not self.client.is_connected():
            self._set_status("unavailable", "Robot link offline. Cannot send auto mode command.")
            return self.payload(), HTTPStatus.SERVICE_UNAVAILABLE

        if not self.available_modes:
            self._set_status("unavailable", "Auto mode chooser not available from the robot.")
            return self.payload(), HTTPStatus.SERVICE_UNAVAILABLE

        if mode_id not in self.available_modes:
            self._set_status("rejected", f"Requested mode '{mode_id}' is not available.")
            self.last_command_at = iso_now()
            return self.payload(), HTTPStatus.BAD_REQUEST

        success = self.client.put_subtable_string(AUTO_MODE_CHOOSER_PATH, "selected", mode_id)
        self.last_command_at = iso_now()
        self.requested_mode_id = mode_id

        if not success:
            self._set_status("rejected", "Failed to publish selected auto mode to NetworkTables.")
            return self.payload(), HTTPStatus.BAD_GATEWAY

        self._pending_mode_id = mode_id
        self._pending_since = utc_now()
        self._set_status("pending", f"Requested auto mode change to {mode_id}.")
        return self.payload(), HTTPStatus.ACCEPTED


class TelemetryBridge:
    def __init__(self, team: int):
        self.client = NTClient(team)
        self.control_mode = ControlModeManager(self.client)

    def _get_bool_alias(self, *keys: str, default: bool = False) -> bool:
        for key in keys:
            if self.client.has_key(key):
                return self.client.get_bool(key, default)
        return default

    def _get_optional_bool_alias(self, *keys: str) -> bool | None:
        for key in keys:
            value = self.client.get_optional_bool(key)
            if value is not None:
                return value
        return None

    def _get_number_alias(self, *keys: str, default: float = 0.0) -> float:
        for key in keys:
            if self.client.has_key(key):
                return self.client.get_number(key, default)
        return default

    def _get_string_alias(self, *keys: str, default: str = "") -> str:
        for key in keys:
            if self.client.has_key(key):
                return self.client.get_string(key, default)
        return default

    def bridge_status(self) -> dict[str, Any]:
        control_state = self.control_mode.payload()
        return {
            "transport": "networktables",
            "chooserPath": f"SmartDashboard/{AUTO_MODE_CHOOSER_PATH}",
            "telemetryEndpoint": "/api/telemetry",
            "controlModeEndpoint": "/api/control-mode",
            "connected": self.client.is_connected(),
            "lastSyncAt": control_state.get("lastSyncAt"),
            "message": control_state.get("message"),
        }

    def payload(self) -> dict[str, Any]:
        control_mode = self.control_mode.refresh()
        online = self.client.is_connected()
        lidar_healthy = self._get_bool_alias(
            "Telemetry/Lidar/Healthy",
            "Telemetry/LiDAR/Healthy",
            default=False,
        )
        valid_scan = self._get_bool_alias(
            "Telemetry/Lidar/Has Valid Scan",
            "Telemetry/LiDAR/Has Valid Scan",
            default=False,
        )
        navx_connected = self._get_bool_alias(
            "Telemetry/NavX/Connected",
            "Telemetry/Navx/Connected",
            default=False,
        )
        pending_turn_direction = self._get_string_alias(
            "Telemetry/Reactive/Pending Turn",
            default="NONE",
        )
        pending_turn_armed = self._get_optional_bool_alias("Telemetry/Reactive/Pending Turn Armed")
        turn_detected = self._get_optional_bool_alias("Telemetry/Reactive/Turn Detected")

        if turn_detected is None:
            turn_detected = self._get_optional_bool_alias("Telemetry/Reactive/Turn Detection Ready")

        if pending_turn_armed is None:
            pending_turn_armed = pending_turn_direction not in ("", "NONE")

        if online and lidar_healthy and valid_scan:
            connection_health = "stable"
        elif online:
            connection_health = "degraded"
        else:
            connection_health = "unstable"

        if self.client.connection_mode == "team-auto":
            route_label = "NetworkTables team discovery"
        elif self.client.connection_mode == "manual-fallback":
            route_label = "Manual fallback route"
        else:
            route_label = "Bridge telemetry route"

        connected_host = self.client.connected_host
        if not online and connected_host == "unknown":
            connected_host = "--"
        elif online and connected_host == "unknown":
            connected_host = self.client.connection_target

        return {
            "timestamp": iso_now(),
            "scenarioLabel": "live robot telemetry" if online else "live standby",
            "bridgeStatus": self.bridge_status(),
            "connection": {
                "online": online,
                "team": self.client.team,
                "target": self.client.connection_target,
                "hostSeen": connected_host,
                "mode": self.client.connection_mode,
                "routeLabel": route_label,
                "health": connection_health,
            },
            "heading": {
                "yawDeg": self._get_number_alias("Telemetry/Reactive/Pose Heading (deg)", default=0.0),
                "targetYawDeg": self._get_number_alias("Telemetry/Reactive/Target Yaw (deg)", default=0.0),
                "angularErrorDeg": self._get_number_alias("Telemetry/Reactive/Angular Error", default=0.0),
                "lateralErrorM": self._get_number_alias("Telemetry/Reactive/Lateral Error", default=0.0),
            },
            "perception": {
                "frontMedianMm": self._get_number_alias("Telemetry/Reactive/Front Median (mm)", default=0.0),
                "leftWallMm": self._get_number_alias("Telemetry/Reactive/Left Wall Median (mm)", default=0.0),
                "rightWallMm": self._get_number_alias("Telemetry/Reactive/Right Wall Median (mm)", default=0.0),
                "leftOpenMm": self._get_number_alias("Telemetry/Reactive/Left Open Median (mm)", default=0.0),
                "rightOpenMm": self._get_number_alias("Telemetry/Reactive/Right Open Median (mm)", default=0.0),
                "frontBlocked": self._get_bool_alias("Telemetry/Reactive/Front Blocked", default=False),
                "frontSlow": self._get_bool_alias("Telemetry/Reactive/Front Slow", default=False),
                "leftOpenFlag": self._get_bool_alias("Telemetry/Reactive/Left Open", default=False),
                "rightOpenFlag": self._get_bool_alias("Telemetry/Reactive/Right Open", default=False),
                "deadEnd": self._get_bool_alias("Telemetry/Reactive/Dead End", default=False),
            },
            "commands": {
                "center": self._get_number_alias("Telemetry/Reactive/Center Command", default=0.0),
                "forward": self._get_number_alias("Telemetry/Reactive/Forward Command", default=0.0),
                "rotation": self._get_number_alias("Telemetry/Reactive/Rotation Command", default=0.0),
            },
            "encoders": {
                "leftMm": self._get_number_alias("Telemetry/Drive/Encoder Left (mm)", default=0.0),
                "rightMm": self._get_number_alias("Telemetry/Drive/Encoder Right (mm)", default=0.0),
                "backMm": self._get_number_alias("Telemetry/Drive/Encoder Back (mm)", default=0.0),
                "forwardDistanceCm": self._get_number_alias("Telemetry/Drive/Forward Distance (cm)", default=0.0),
            },
            "systems": {
                "lidarHealthy": lidar_healthy,
                "navxConnected": navx_connected,
                "validScan": valid_scan,
                "gyroHold": self._get_bool_alias("Telemetry/Reactive/Gyro Hold Active", default=False),
            },
            "reactive": {
                "state": self._get_string_alias("Telemetry/Reactive/State", default="OFFLINE"),
                "decision": self._get_string_alias(
                    "Debug/Reactive/Decision",
                    "Waiting for live telemetry from the robot bridge.",
                    default="Waiting for live telemetry from the robot bridge.",
                ),
                "driveControl": self._get_string_alias(
                    "Debug/Reactive/Drive Control",
                    "No drive command stream available.",
                    default="No drive command stream available.",
                ),
                "lastTurn": self._get_string_alias("Debug/Reactive/Last Turn", default="none"),
                "stateTimeSec": self._get_number_alias("Telemetry/Reactive/State Time (s)", default=0.0),
                "stableScans": self._get_number_alias(
                    "Telemetry/Reactive/Stable Scan Cycles",
                    default=0.0,
                ),
                "pendingTurnDirection": pending_turn_direction or None,
                "pendingTurnArmed": pending_turn_armed,
                "turnDetected": turn_detected,
                "turnExecutable": self._get_optional_bool_alias("Telemetry/Reactive/Turn Executable"),
            },
            "controlMode": control_mode,
        }


def build_handler(bridge: TelemetryBridge):
    class Handler(BaseHTTPRequestHandler):
        def _send_json(self, payload: dict[str, Any], status: HTTPStatus = HTTPStatus.OK) -> None:
            body = json.dumps(payload).encode("utf-8")
            self.send_response(status.value)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.end_headers()
            self.wfile.write(body)

        def _read_json(self) -> dict[str, Any]:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0:
                return {}
            return json.loads(self.rfile.read(length).decode("utf-8"))

        def do_OPTIONS(self) -> None:  # noqa: N802
            self.send_response(HTTPStatus.NO_CONTENT.value)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.end_headers()

        def do_GET(self) -> None:  # noqa: N802
            if self.path == "/health":
                self._send_json({"ok": True})
                return

            if self.path == "/api/telemetry":
                self._send_json(bridge.payload())
                return

            if self.path == "/api/control-mode":
                self._send_json(
                    {
                        "controlMode": bridge.control_mode.refresh(),
                        "bridgeStatus": bridge.bridge_status(),
                    }
                )
                return

            self._send_json({"error": "not found"}, status=HTTPStatus.NOT_FOUND)

        def do_POST(self) -> None:  # noqa: N802
            if self.path != "/api/control-mode":
                self._send_json({"error": "not found"}, status=HTTPStatus.NOT_FOUND)
                return

            payload = self._read_json()
            if payload.get("type") != "set_control_mode":
                self._send_json({"error": "unsupported command"}, status=HTTPStatus.BAD_REQUEST)
                return

            mode_id = str(payload.get("payload", {}).get("modeId", "")).strip()
            if not mode_id:
                self._send_json({"error": "modeId is required"}, status=HTTPStatus.BAD_REQUEST)
                return

            control_mode, status = bridge.control_mode.request_mode_change(mode_id)
            self._send_json(
                {
                    "controlMode": control_mode,
                    "bridgeStatus": bridge.bridge_status(),
                },
                status=status,
            )

        def log_message(self, format: str, *args: object) -> None:
            return

    return Handler


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Bridge NetworkTables telemetry to HTTP JSON.")
    parser.add_argument("--host", default="127.0.0.1", help="HTTP bind host")
    parser.add_argument("--port", type=int, default=8765, help="HTTP bind port")
    parser.add_argument("--team", type=int, default=load_team_number(), help="FRC team number")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    bridge = TelemetryBridge(args.team)
    server = ThreadingHTTPServer((args.host, args.port), build_handler(bridge))
    print(f"Telemetry bridge listening on http://{args.host}:{args.port}")
    print(f"NetworkTables target team: {args.team}")
    server.serve_forever()


if __name__ == "__main__":
    main()
