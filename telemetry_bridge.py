from __future__ import annotations

import argparse
import json
import math
from datetime import datetime, timedelta, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

from nt_client import NTClient, load_team_number


AUTO_MODE_CHOOSER_PATH = "Auto mode"
APPLIED_STATUS_HOLD = timedelta(seconds=2)
PENDING_TIMEOUT = timedelta(seconds=5)
TOPIC_SCOPE_ORDER = ("telemetry", "debug", "config", "auto-mode", "other")

NT_TYPE_BOOLEAN = 0x01
NT_TYPE_DOUBLE = 0x02
NT_TYPE_STRING = 0x04
NT_TYPE_RAW = 0x08
NT_TYPE_BOOLEAN_ARRAY = 0x10
NT_TYPE_DOUBLE_ARRAY = 0x20
NT_TYPE_STRING_ARRAY = 0x40
EDITABLE_VALUE_KINDS = {"number", "boolean", "string"}
BATTERY_NOMINAL_CAPACITY_AH = 18.0
REMOTE_DRIVER_ACTIONS = {
    "enable_teleop",
    "enable_auto",
    "disable",
    "reset",
    "estop",
}


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def iso_now() -> str:
    return utc_now().isoformat()


def format_number(value: float) -> str:
    if math.isfinite(value) and float(value).is_integer():
        return str(int(value))
    return f"{value:.3f}".rstrip("0").rstrip(".")


def normalize_angle_delta(value: float) -> float:
    while value > 180.0:
        value -= 360.0
    while value < -180.0:
        value += 360.0
    return value


def classify_scope(key: str) -> str:
    if key.startswith("Telemetry/"):
        return "telemetry"
    if key.startswith("Debug/"):
        return "debug"
    if key.startswith("Config/"):
        return "config"
    if key.startswith(f"{AUTO_MODE_CHOOSER_PATH}/") or key == AUTO_MODE_CHOOSER_PATH:
        return "auto-mode"
    return "other"


def normalize_scalar_value(value: Any) -> tuple[str, Any, str]:
    if isinstance(value, bool):
        return "boolean", value, "true" if value else "false"

    if isinstance(value, (int, float)) and not isinstance(value, bool):
        numeric = float(value)
        if not math.isfinite(numeric):
            return "number", None, str(value)
        return "number", numeric, format_number(numeric)

    if isinstance(value, str):
        return "string", value, value if value else "(empty string)"

    if isinstance(value, (bytes, bytearray)):
        preview = bytes(value[:16]).hex()
        suffix = "..." if len(value) > 16 else ""
        return "raw", None, f"{len(value)} bytes {preview}{suffix}".strip()

    if value is None:
        return "unknown", None, "unavailable"

    return "unknown", str(value), str(value)


def normalize_array_value(values: list[Any], type_id: int) -> tuple[str, list[Any], str]:
    if values:
        if all(isinstance(item, bool) for item in values):
            return (
                "boolean-array",
                [bool(item) for item in values],
                "[" + ", ".join("true" if item else "false" for item in values) + "]",
            )

        if all(isinstance(item, (int, float)) and not isinstance(item, bool) for item in values):
            safe_values: list[float | None] = []
            formatted_values: list[str] = []
            for item in values:
                numeric = float(item)
                if math.isfinite(numeric):
                    safe_values.append(numeric)
                    formatted_values.append(format_number(numeric))
                else:
                    safe_values.append(None)
                    formatted_values.append(str(item))
            return "number-array", safe_values, "[" + ", ".join(formatted_values) + "]"

        if all(isinstance(item, str) for item in values):
            return "string-array", [str(item) for item in values], "[" + ", ".join(values) + "]"

    if type_id == NT_TYPE_BOOLEAN_ARRAY:
        return "boolean-array", [], "[]"
    if type_id == NT_TYPE_DOUBLE_ARRAY:
        return "number-array", [], "[]"
    if type_id == NT_TYPE_STRING_ARRAY:
        return "string-array", [], "[]"

    stringified = [str(item) for item in values]
    return "unknown", stringified, json.dumps(stringified)


def normalize_topic_value(value: Any, type_id: int) -> tuple[str, Any, str]:
    if isinstance(value, (list, tuple)):
        return normalize_array_value(list(value), type_id)

    if type_id == NT_TYPE_RAW and value is None:
        return "raw", None, "raw payload"

    return normalize_scalar_value(value)


def serialize_topic_entry(entry: dict[str, Any]) -> dict[str, Any] | None:
    key = str(entry.get("key", "")).strip("/")
    if not key:
        return None

    segments = [segment for segment in key.split("/") if segment]
    if not segments:
        return None

    value_kind, value, value_text = normalize_topic_value(entry.get("value"), int(entry.get("typeId") or 0))
    group_path = "/".join(segments[:-1])
    is_writable = value_kind in EDITABLE_VALUE_KINDS and (
        classify_scope(key) == "config" or bool(entry.get("persistent", False))
    )

    return {
        "key": key,
        "label": segments[-1],
        "scope": classify_scope(key),
        "segments": segments,
        "groupPath": group_path,
        "valueKind": value_kind,
        "value": value,
        "valueText": value_text,
        "persistent": bool(entry.get("persistent", False)),
        "isWritable": is_writable,
    }


def parse_write_value(raw_value: Any, value_kind: str) -> tuple[Any, str] | None:
    if value_kind == "number":
        if isinstance(raw_value, bool):
            return None
        try:
            numeric = float(raw_value)
        except (TypeError, ValueError):
            return None
        if not math.isfinite(numeric):
            return None
        return numeric, format_number(numeric)

    if value_kind == "boolean":
        if isinstance(raw_value, bool):
            return raw_value, "true" if raw_value else "false"

        if isinstance(raw_value, str):
            normalized = raw_value.strip().lower()
            if normalized in {"true", "1", "yes", "on"}:
                return True, "true"
            if normalized in {"false", "0", "no", "off"}:
                return False, "false"
        return None

    if value_kind == "string":
        if raw_value is None:
            return None
        text = str(raw_value)
        return text, text if text else "(empty string)"

    return None


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


class RemoteDriverManager:
    def __init__(self, client: NTClient):
        self.client = client
        self.packet_sequence = 0
        self.action_sequence = 0
        self.last_packet_at: str | None = None
        self.last_action_at: str | None = None

    def _get_bool(self, key: str, default: bool = False) -> bool:
        if self.client.has_key(key):
            return self.client.get_bool(key, default)
        return default

    def _get_number(self, key: str, default: float = 0.0) -> float:
        if self.client.has_key(key):
            return self.client.get_number(key, default)
        return default

    def _get_optional_number(self, key: str) -> float | None:
        if not self.client.has_key(key):
            return None
        return self.client.get_number(key, 0.0)

    def _get_string(self, key: str, default: str = "") -> str:
        if self.client.has_key(key):
            return self.client.get_string(key, default)
        return default

    def payload(self) -> dict[str, Any]:
        raw_mode = self._get_string("Telemetry/Remote Driver/Mode", "DISABLED").strip().upper()
        if raw_mode == "TELEOP":
            mode = "teleop"
        elif raw_mode == "AUTONOMOUS":
            mode = "autonomous"
        else:
            mode = "disabled"

        online = self.client.is_connected()
        status = self._get_string(
            "Telemetry/Remote Driver/Status",
            "Robot offline. Remote driver unavailable." if not online else "Remote driver status unavailable.",
        )

        return {
            "active": self._get_bool("Telemetry/Remote Driver/Active", False),
            "mode": mode,
            "heartbeatFresh": self._get_bool("Telemetry/Remote Driver/Heartbeat Fresh", False),
            "heartbeatAgeSec": self._get_optional_number("Telemetry/Remote Driver/Heartbeat Age (s)"),
            "source": self._get_string("Telemetry/Remote Driver/Source", "ORION"),
            "inputSource": self._get_string("Telemetry/Remote Driver/Input Source", "idle"),
            "lastAction": self._get_string("Telemetry/Remote Driver/Last Action", "none"),
            "driveX": self._get_number("Telemetry/Remote Driver/Drive X", 0.0),
            "driveY": self._get_number("Telemetry/Remote Driver/Drive Y", 0.0),
            "driveZ": self._get_number("Telemetry/Remote Driver/Drive Z", 0.0),
            "gyroAssist": self._get_bool("Telemetry/Remote Driver/Gyro Assist", True),
            "robotEnabled": self._get_bool("Telemetry/Robot/Enabled", False),
            "status": status,
            "lastPacketAt": self.last_packet_at,
            "lastActionAt": self.last_action_at,
        }

    def _publish_zero_packet(self, source: str) -> bool:
        self.packet_sequence += 1
        return all(
            (
                self.client.put_number("Control/Remote Driver/Drive X", 0.0),
                self.client.put_number("Control/Remote Driver/Drive Y", 0.0),
                self.client.put_number("Control/Remote Driver/Drive Z", 0.0),
                self.client.put_bool("Control/Remote Driver/Gyro Assist", True),
                self.client.put_string("Control/Remote Driver/Source", source),
                self.client.put_string("Control/Remote Driver/Input Source", "idle"),
                self.client.put_number("Control/Remote Driver/Packet Sequence", float(self.packet_sequence)),
            )
        )

    def publish_state(
        self,
        x: Any,
        y: Any,
        z: Any,
        gyro_assist: Any,
        source: str,
        input_source: str,
    ) -> tuple[dict[str, Any], HTTPStatus]:
        if not self.client.is_connected():
            return {"error": "robot link offline"}, HTTPStatus.SERVICE_UNAVAILABLE

        try:
            clamped_x = max(-1.0, min(1.0, float(x)))
            clamped_y = max(-1.0, min(1.0, float(y)))
            clamped_z = max(-1.0, min(1.0, float(z)))
        except (TypeError, ValueError):
            return {"error": "x, y and z must be numeric"}, HTTPStatus.BAD_REQUEST

        if not all(math.isfinite(value) for value in (clamped_x, clamped_y, clamped_z)):
            return {"error": "x, y and z must be finite"}, HTTPStatus.BAD_REQUEST

        self.packet_sequence += 1
        safe_source = source.strip() or "ORION"
        safe_input_source = input_source.strip() or "idle"
        success = all(
            (
                self.client.put_number("Control/Remote Driver/Drive X", clamped_x),
                self.client.put_number("Control/Remote Driver/Drive Y", clamped_y),
                self.client.put_number("Control/Remote Driver/Drive Z", clamped_z),
                self.client.put_bool("Control/Remote Driver/Gyro Assist", bool(gyro_assist)),
                self.client.put_string("Control/Remote Driver/Source", safe_source),
                self.client.put_string("Control/Remote Driver/Input Source", safe_input_source),
                self.client.put_number("Control/Remote Driver/Packet Sequence", float(self.packet_sequence)),
            )
        )

        if not success:
            return {"error": "failed to publish remote driver packet"}, HTTPStatus.BAD_GATEWAY

        self.last_packet_at = iso_now()
        return {
            "remoteDriver": self.payload(),
            "message": "Remote driver packet published.",
        }, HTTPStatus.ACCEPTED

    def publish_action(self, action: str, source: str) -> tuple[dict[str, Any], HTTPStatus]:
        if not self.client.is_connected():
            return {"error": "robot link offline"}, HTTPStatus.SERVICE_UNAVAILABLE

        normalized_action = action.strip().lower()
        if normalized_action not in REMOTE_DRIVER_ACTIONS:
            return {"error": f"unsupported action '{action}'"}, HTTPStatus.BAD_REQUEST

        safe_source = source.strip() or "ORION"
        zero_packet_ok = True
        if normalized_action in {"disable", "reset", "estop", "enable_auto"}:
            zero_packet_ok = self._publish_zero_packet(safe_source)

        self.action_sequence += 1
        action_ok = all(
            (
                self.client.put_string("Control/Remote Driver/Source", safe_source),
                self.client.put_string("Control/Remote Driver/Requested Action", normalized_action),
                self.client.put_number("Control/Remote Driver/Action Sequence", float(self.action_sequence)),
            )
        )

        if not zero_packet_ok or not action_ok:
            return {"error": "failed to publish remote driver action"}, HTTPStatus.BAD_GATEWAY

        self.last_action_at = iso_now()
        return {
            "remoteDriver": self.payload(),
            "message": f"Remote action '{normalized_action}' published.",
        }, HTTPStatus.ACCEPTED


class TelemetryBridge:
    def __init__(self, team: int):
        self.client = NTClient(team)
        self.control_mode = ControlModeManager(self.client)
        self.remote_driver = RemoteDriverManager(self.client)

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
            "topicCatalogEndpoint": "/api/topics",
            "topicWriteEndpoint": "/api/topics/write",
            "remoteDriverEndpoint": "/api/remote-driver",
            "connected": self.client.is_connected(),
            "lastSyncAt": control_state.get("lastSyncAt"),
            "message": control_state.get("message"),
        }

    def topics_payload(self) -> dict[str, Any]:
        topics: list[dict[str, Any]] = []
        scope_counts = {scope: 0 for scope in TOPIC_SCOPE_ORDER}
        group_paths: set[str] = set()

        for raw_entry in self.client.get_all_entries():
            serialized = serialize_topic_entry(raw_entry)
            if serialized is None:
                continue

            topics.append(serialized)
            scope_counts[serialized["scope"]] = scope_counts.get(serialized["scope"], 0) + 1
            if serialized["groupPath"]:
                group_paths.add(serialized["groupPath"])

        return {
            "timestamp": iso_now(),
            "bridgeStatus": self.bridge_status(),
            "stats": {
                "online": self.client.is_connected(),
                "team": self.client.team,
                "totalTopics": len(topics),
                "groupCount": len(group_paths),
                "scopeCounts": scope_counts,
            },
            "topics": topics,
        }

    def update_topic_value(self, key: str, value_kind: str, value: Any) -> tuple[dict[str, Any], HTTPStatus]:
        if not self.client.is_connected():
            return {"error": "robot link offline"}, HTTPStatus.SERVICE_UNAVAILABLE

        entry = self.client.read_entry(key)
        serialized = serialize_topic_entry(entry) if entry is not None else None

        if serialized is None:
            return {"error": "topic not found"}, HTTPStatus.NOT_FOUND

        if not serialized.get("isWritable"):
            return {"error": "topic is not writable"}, HTTPStatus.FORBIDDEN

        if serialized.get("valueKind") != value_kind:
            return {"error": "valueKind does not match the live topic type"}, HTTPStatus.BAD_REQUEST

        parsed = parse_write_value(value, value_kind)
        if parsed is None:
            return {"error": "invalid value for topic type"}, HTTPStatus.BAD_REQUEST

        coerced_value, _ = parsed

        if value_kind == "number":
            success = self.client.put_number(key, float(coerced_value))
        elif value_kind == "boolean":
            success = self.client.put_bool(key, bool(coerced_value))
        elif value_kind == "string":
            success = self.client.put_string(key, str(coerced_value))
        else:
            return {"error": "unsupported topic type"}, HTTPStatus.BAD_REQUEST

        if not success:
            return {"error": "failed to publish value to NetworkTables"}, HTTPStatus.BAD_GATEWAY

        updated_entry = self.client.read_entry(key)
        updated_topic = serialize_topic_entry(updated_entry) if updated_entry is not None else serialized

        return {
            "topic": updated_topic,
            "message": f"Updated {key}.",
        }, HTTPStatus.ACCEPTED

    def payload(self) -> dict[str, Any]:
        control_mode = self.control_mode.refresh()
        online = self.client.is_connected()
        robot_enabled = self._get_bool_alias("Telemetry/Robot/Enabled", default=False)
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

        battery_voltage = self._get_number_alias("Telemetry/Robot/Battery Voltage", default=0.0)
        battery_current = self._get_number_alias("Telemetry/Robot/Battery Current", default=0.0)
        battery_power = battery_voltage * battery_current
        battery_soc = max(0.0, min(1.0, (battery_voltage - 10.4) / 2.4)) if battery_voltage > 0 else 0.0
        estimated_runtime_min = None
        if battery_current > 0.5 and battery_voltage > 0:
            remaining_wh = battery_soc * BATTERY_NOMINAL_CAPACITY_AH * 12.0
            estimated_runtime_min = max(0.0, (remaining_wh / max(battery_power, 1.0)) * 60.0)

        live_yaw_deg = self._get_number_alias(
            "Telemetry/NavX/Filtered Yaw (deg)",
            "Telemetry/Drive/Yaw (deg)",
            "Telemetry/Reactive/Pose Heading (deg)",
            "Telemetry/NavX/Raw Yaw (deg)",
            default=0.0,
        )
        reactive_target_yaw_deg = self._get_number_alias(
            "Telemetry/Reactive/Target Yaw (deg)",
            default=live_yaw_deg,
        )

        if robot_enabled:
            target_yaw_deg = reactive_target_yaw_deg
            angular_error_deg = normalize_angle_delta(target_yaw_deg - live_yaw_deg)
        else:
            target_yaw_deg = live_yaw_deg
            angular_error_deg = 0.0

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
                "yawDeg": live_yaw_deg,
                "targetYawDeg": target_yaw_deg,
                "angularErrorDeg": angular_error_deg,
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
            "battery": {
                "voltageV": battery_voltage,
                "currentA": battery_current,
                "powerW": battery_power,
                "stateOfCharge": battery_soc,
                "estimatedRuntimeMin": estimated_runtime_min,
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
            "remoteDriver": self.remote_driver.payload(),
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

            if self.path == "/api/topics":
                self._send_json(bridge.topics_payload())
                return

            if self.path == "/api/control-mode":
                self._send_json(
                    {
                        "controlMode": bridge.control_mode.refresh(),
                        "bridgeStatus": bridge.bridge_status(),
                    }
                )
                return

            if self.path == "/api/remote-driver":
                self._send_json(
                    {
                        "remoteDriver": bridge.remote_driver.payload(),
                        "bridgeStatus": bridge.bridge_status(),
                    }
                )
                return

            self._send_json({"error": "not found"}, status=HTTPStatus.NOT_FOUND)

        def do_POST(self) -> None:  # noqa: N802
            payload = self._read_json()

            if self.path == "/api/control-mode":
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
                return

            if self.path == "/api/topics/write":
                if payload.get("type") != "write_topic_value":
                    self._send_json({"error": "unsupported command"}, status=HTTPStatus.BAD_REQUEST)
                    return

                topic_payload = payload.get("payload", {})
                key = str(topic_payload.get("key", "")).strip()
                value_kind = str(topic_payload.get("valueKind", "")).strip()
                if not key or not value_kind:
                    self._send_json({"error": "key and valueKind are required"}, status=HTTPStatus.BAD_REQUEST)
                    return

                response, status = bridge.update_topic_value(key, value_kind, topic_payload.get("value"))
                self._send_json(
                    {
                        **response,
                        "bridgeStatus": bridge.bridge_status(),
                    },
                    status=status,
                )
                return

            if self.path == "/api/remote-driver/state":
                if payload.get("type") != "set_remote_driver_state":
                    self._send_json({"error": "unsupported command"}, status=HTTPStatus.BAD_REQUEST)
                    return

                driver_payload = payload.get("payload", {})
                response, status = bridge.remote_driver.publish_state(
                    x=driver_payload.get("x"),
                    y=driver_payload.get("y"),
                    z=driver_payload.get("z"),
                    gyro_assist=driver_payload.get("gyroAssist", True),
                    source=str(driver_payload.get("source", "ORION")),
                    input_source=str(driver_payload.get("inputSource", "idle")),
                )
                self._send_json(
                    {
                        **response,
                        "bridgeStatus": bridge.bridge_status(),
                    },
                    status=status,
                )
                return

            if self.path == "/api/remote-driver/action":
                if payload.get("type") != "send_remote_driver_action":
                    self._send_json({"error": "unsupported command"}, status=HTTPStatus.BAD_REQUEST)
                    return

                driver_payload = payload.get("payload", {})
                response, status = bridge.remote_driver.publish_action(
                    action=str(driver_payload.get("action", "")),
                    source=str(driver_payload.get("source", "ORION")),
                )
                self._send_json(
                    {
                        **response,
                        "bridgeStatus": bridge.bridge_status(),
                    },
                    status=status,
                )
                return

            self._send_json({"error": "not found"}, status=HTTPStatus.NOT_FOUND)

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
