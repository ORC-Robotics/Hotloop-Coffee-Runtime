from __future__ import annotations

import json
import os
import socket
import threading
import time
from pathlib import Path

from networktables import NetworkTablesInstance


DEFAULT_TEAM = 1234
NT_PORT = 1735


def load_team_number() -> int:
    env_team = os.getenv("FRC_TEAM")
    if env_team and env_team.isdigit():
        return int(env_team)

    candidates = [
        Path.cwd() / ".wpilib" / "wpilib_preferences.json",
        Path(__file__).resolve().parent / ".wpilib" / "wpilib_preferences.json",
        Path.home() / ".wpilib" / "wpilib_preferences.json",
    ]

    for path in candidates:
        if not path.exists():
            continue
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            team = data.get("teamNumber")
            if isinstance(team, int):
                return team
        except Exception:
            pass

    return DEFAULT_TEAM


def team_to_ip_prefix(team: int) -> str:
    return f"10.{team // 100}.{team % 100}"


def candidate_hosts(team: int) -> list[str]:
    prefix = team_to_ip_prefix(team)
    hosts: list[str] = []

    manual_host = os.getenv("ROBOT_HOST")
    if manual_host:
        hosts.append(manual_host)

    hosts.extend(
        [
            f"roborio-{team}-frc.local",
            f"{prefix}.2",
            f"{prefix}.11",
            "vmxpi.local",
            "localhost",
            "127.0.0.1",
        ]
    )

    deduped = []
    seen = set()
    for host in hosts:
        if host not in seen:
            seen.add(host)
            deduped.append(host)
    return deduped


def first_reachable_host(
    hosts: list[str],
    port: int = NT_PORT,
    timeout: float = 0.35,
) -> str | None:
    for host in hosts:
        try:
            with socket.create_connection((host, port), timeout=timeout):
                return host
        except OSError:
            continue
    return None


class NTClient:
    def __init__(self, team: int):
        self.team = team
        self.inst = NetworkTablesInstance.getDefault()
        self.sd = self.inst.getTable("SmartDashboard")
        self.connection_mode = "team-auto"
        self.connection_target = f"team {team}"
        self.connected_host = "unknown"
        self._lock = threading.Lock()

        self._start_client()

        self._monitor_thread = threading.Thread(target=self._monitor_loop, daemon=True)
        self._monitor_thread.start()

    def _start_client(self) -> None:
        hosts = candidate_hosts(self.team)

        start_client_team = getattr(self.inst, "startClientTeam", None)
        start_ds = getattr(self.inst, "startDSClient", None)

        if callable(start_client_team):
            self.connection_mode = "team-auto"
            self.connection_target = f"team {self.team}"
            start_client_team(self.team)
            if callable(start_ds):
                start_ds()
            return

        host = first_reachable_host(hosts) or hosts[0]
        self.connection_mode = "manual-fallback"
        self.connection_target = host

        stop_client = getattr(self.inst, "stopClient", None)
        start_client = getattr(self.inst, "startClient", None)

        if callable(stop_client):
            try:
                stop_client()
            except Exception:
                pass

        if callable(start_client):
            start_client(host)

    def _monitor_loop(self) -> None:
        while True:
            try:
                connected = self.is_connected()
                if not connected and self.connection_mode == "manual-fallback":
                    host = first_reachable_host(candidate_hosts(self.team))
                    if host and host != self.connection_target:
                        with self._lock:
                            self.connection_target = host
                            stop_client = getattr(self.inst, "stopClient", None)
                            start_client = getattr(self.inst, "startClient", None)
                            if callable(stop_client):
                                try:
                                    stop_client()
                                except Exception:
                                    pass
                            if callable(start_client):
                                start_client(host)
                else:
                    reachable = first_reachable_host(candidate_hosts(self.team))
                    if reachable:
                        self.connected_host = reachable
            except Exception:
                pass

            time.sleep(1.0)

    def is_connected(self) -> bool:
        is_connected = getattr(self.inst, "isConnected", None)
        if callable(is_connected):
            try:
                return bool(is_connected())
            except Exception:
                return False
        return False

    def get_string(self, key: str, default: str = "") -> str:
        try:
            return self.sd.getString(key, default)
        except Exception:
            return default

    def get_number(self, key: str, default: float = 0.0) -> float:
        try:
            return float(self.sd.getNumber(key, default))
        except Exception:
            return default

    def get_bool(self, key: str, default: bool = False) -> bool:
        try:
            return bool(self.sd.getBoolean(key, default))
        except Exception:
            return default

    def has_key(self, key: str) -> bool:
        try:
            contains_key = getattr(self.sd, "containsKey", None)
            if callable(contains_key):
                return bool(contains_key(key))
        except Exception:
            return False
        return False

    def get_optional_bool(self, key: str) -> bool | None:
        if not self.has_key(key):
            return None
        try:
            return bool(self.sd.getBoolean(key, False))
        except Exception:
            return None

    def get_subtable(self, path: str):
        try:
            table = self.sd
            for segment in path.split("/"):
                if not segment:
                    continue
                table = table.getSubTable(segment)
            return table
        except Exception:
            return None

    def get_subtable_string(self, path: str, key: str, default: str = "") -> str:
        table = self.get_subtable(path)
        if table is None:
            return default
        try:
            return table.getString(key, default)
        except Exception:
            return default

    def get_subtable_string_array(self, path: str, key: str, default: list[str] | None = None) -> list[str]:
        table = self.get_subtable(path)
        if table is None:
            return default or []
        try:
            return list(table.getStringArray(key, default or []))
        except Exception:
            return default or []

    def put_subtable_string(self, path: str, key: str, value: str) -> bool:
        table = self.get_subtable(path)
        if table is None:
            return False
        try:
            return bool(table.putString(key, value))
        except Exception:
            return False
