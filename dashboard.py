from __future__ import annotations

import math
import time
import tkinter as tk

from nt_client import NTClient, load_team_number


REFRESH_MS = 150


FIELDS = [
    (
        "Connection",
        [
            ("Status", "status", "string"),
            ("Mode", "mode", "string"),
            ("Target", "target", "string"),
            ("Host Seen", "host_seen", "string"),
            ("Team", "team", "string"),
        ],
    ),
    (
        "Robot",
        [
            ("Enabled", "Telemetry/Robot/Enabled", "bool"),
            ("Lidar Healthy", "Telemetry/Lidar/Healthy", "bool"),
            ("Valid Scan", "Telemetry/Lidar/Has Valid Scan", "bool"),
            ("NavX Connected", "Telemetry/NavX/Connected", "bool"),
            ("Gyro Hold", "Telemetry/Reactive/Gyro Hold Active", "bool"),
        ],
    ),
    (
        "State",
        [
            ("Reactive State", "Telemetry/Reactive/State", "string"),
            ("Decision", "Debug/Reactive/Decision", "string"),
            ("Drive Control", "Debug/Reactive/Drive Control", "string"),
            ("Last Turn", "Debug/Reactive/Last Turn", "string"),
            ("State Time (s)", "Telemetry/Reactive/State Time (s)", "number"),
            ("Stable Scans", "Telemetry/Reactive/Stable Scan Cycles", "number"),
        ],
    ),
    (
        "Heading",
        [
            ("Yaw (deg)", "Telemetry/Reactive/Pose Heading (deg)", "number"),
            ("Target Yaw (deg)", "Telemetry/Reactive/Target Yaw (deg)", "number"),
            ("Angular Error", "Telemetry/Reactive/Angular Error", "number"),
            ("Lateral Error", "Telemetry/Reactive/Lateral Error", "number"),
        ],
    ),
    (
        "Perception",
        [
            ("Front Median (mm)", "Telemetry/Reactive/Front Median (mm)", "number"),
            ("Left Wall (mm)", "Telemetry/Reactive/Left Wall Median (mm)", "number"),
            ("Right Wall (mm)", "Telemetry/Reactive/Right Wall Median (mm)", "number"),
            ("Left Open (mm)", "Telemetry/Reactive/Left Open Median (mm)", "number"),
            ("Right Open (mm)", "Telemetry/Reactive/Right Open Median (mm)", "number"),
            ("Front Blocked", "Telemetry/Reactive/Front Blocked", "bool"),
            ("Front Slow", "Telemetry/Reactive/Front Slow", "bool"),
            ("Left Open Flag", "Telemetry/Reactive/Left Open", "bool"),
            ("Right Open Flag", "Telemetry/Reactive/Right Open", "bool"),
            ("Dead End", "Telemetry/Reactive/Dead End", "bool"),
        ],
    ),
    (
        "Commands",
        [
            ("Center Command", "Telemetry/Reactive/Center Command", "number"),
            ("Forward Command", "Telemetry/Reactive/Forward Command", "number"),
            ("Rotation Command", "Telemetry/Reactive/Rotation Command", "number"),
        ],
    ),
    (
        "Encoders",
        [
            ("Encoder Left (mm)", "Telemetry/Drive/Encoder Left (mm)", "number"),
            ("Encoder Right (mm)", "Telemetry/Drive/Encoder Right (mm)", "number"),
            ("Encoder Back (mm)", "Telemetry/Drive/Encoder Back (mm)", "number"),
            ("Forward Distance (cm)", "Telemetry/Drive/Forward Distance (cm)", "number"),
        ],
    ),
]


PALETTE = {
    "bg": "#050816",
    "panel": "#0c1326",
    "panel_alt": "#101a31",
    "border": "#1d3159",
    "text": "#eff5ff",
    "muted": "#8194bb",
    "cyan": "#59e1ff",
    "blue": "#5d8cff",
    "magenta": "#8f68ff",
    "good": "#39d98a",
    "warn": "#ffb11f",
    "bad": "#ff5d73",
}

FIELD_KINDS = {key: kind for _, fields in FIELDS for _, key, kind in fields}
FIELD_KINDS.update(
    {
        "status": "bool",
        "mode": "string",
        "target": "string",
        "host_seen": "string",
        "team": "string",
    }
)

OVERVIEW_FIELDS = [
    ("Link", "status"),
    ("Robot", "Telemetry/Robot/Enabled"),
    ("Front Median", "Telemetry/Reactive/Front Median (mm)"),
    ("Reactive State", "Telemetry/Reactive/State"),
]

SYSTEM_HEALTH_FIELDS = [
    ("LiDAR Healthy", "Telemetry/Lidar/Healthy"),
    ("Valid Scan", "Telemetry/Lidar/Has Valid Scan"),
    ("NavX", "Telemetry/NavX/Connected"),
    ("Gyro Hold", "Telemetry/Reactive/Gyro Hold Active"),
    ("Front Blocked", "Telemetry/Reactive/Front Blocked"),
    ("Dead End", "Telemetry/Reactive/Dead End"),
]

STATE_DETAIL_FIELDS = [
    ("Decision", "Debug/Reactive/Decision"),
    ("Drive Control", "Debug/Reactive/Drive Control"),
    ("Last Turn", "Debug/Reactive/Last Turn"),
]

STATE_METRIC_FIELDS = [
    ("State Time", "Telemetry/Reactive/State Time (s)"),
    ("Stable Scans", "Telemetry/Reactive/Stable Scan Cycles"),
]

HEADING_METRIC_FIELDS = [
    ("Yaw", "Telemetry/Reactive/Pose Heading (deg)"),
    ("Target", "Telemetry/Reactive/Target Yaw (deg)"),
    ("Ang Error", "Telemetry/Reactive/Angular Error"),
    ("Lat Error", "Telemetry/Reactive/Lateral Error"),
]

PERCEPTION_METRIC_FIELDS = [
    ("Front", "Telemetry/Reactive/Front Median (mm)"),
    ("Left Wall", "Telemetry/Reactive/Left Wall Median (mm)"),
    ("Right Wall", "Telemetry/Reactive/Right Wall Median (mm)"),
    ("Left Open", "Telemetry/Reactive/Left Open Median (mm)"),
    ("Right Open", "Telemetry/Reactive/Right Open Median (mm)"),
]

PERCEPTION_FLAG_FIELDS = [
    ("Front Blocked", "Telemetry/Reactive/Front Blocked"),
    ("Front Slow", "Telemetry/Reactive/Front Slow"),
    ("Left Open", "Telemetry/Reactive/Left Open"),
    ("Right Open", "Telemetry/Reactive/Right Open"),
    ("Dead End", "Telemetry/Reactive/Dead End"),
]

COMMAND_FIELDS = [
    ("Center", "Telemetry/Reactive/Center Command", PALETTE["cyan"]),
    ("Forward", "Telemetry/Reactive/Forward Command", PALETTE["good"]),
    ("Rotation", "Telemetry/Reactive/Rotation Command", PALETTE["magenta"]),
]

ENCODER_FIELDS = [
    ("Encoder Left", "Telemetry/Drive/Encoder Left (mm)"),
    ("Encoder Right", "Telemetry/Drive/Encoder Right (mm)"),
    ("Encoder Back", "Telemetry/Drive/Encoder Back (mm)"),
    ("Forward Distance", "Telemetry/Drive/Forward Distance (cm)"),
]

NETWORK_FIELDS = [
    ("Mode", "mode"),
    ("Target", "target"),
    ("Host Seen", "host_seen"),
    ("Team", "team"),
]

BOOLEAN_POLARITY = {
    "status": "good",
    "Telemetry/Robot/Enabled": "good",
    "Telemetry/Lidar/Healthy": "good",
    "Telemetry/Lidar/Has Valid Scan": "good",
    "Telemetry/NavX/Connected": "good",
    "Telemetry/Reactive/Gyro Hold Active": "info",
    "Telemetry/Reactive/Front Blocked": "bad",
    "Telemetry/Reactive/Front Slow": "warn",
    "Telemetry/Reactive/Left Open": "good",
    "Telemetry/Reactive/Right Open": "good",
    "Telemetry/Reactive/Dead End": "bad",
}

NUMBER_SUFFIXES = {
    "Telemetry/Reactive/Front Median (mm)": " mm",
    "Telemetry/Reactive/Left Wall Median (mm)": " mm",
    "Telemetry/Reactive/Right Wall Median (mm)": " mm",
    "Telemetry/Reactive/Left Open Median (mm)": " mm",
    "Telemetry/Reactive/Right Open Median (mm)": " mm",
    "Telemetry/Reactive/Pose Heading (deg)": " deg",
    "Telemetry/Reactive/Target Yaw (deg)": " deg",
    "Telemetry/Reactive/Angular Error": " deg",
    "Telemetry/Reactive/State Time (s)": " s",
    "Telemetry/Drive/Encoder Left (mm)": " mm",
    "Telemetry/Drive/Encoder Right (mm)": " mm",
    "Telemetry/Drive/Encoder Back (mm)": " mm",
    "Telemetry/Drive/Forward Distance (cm)": " cm",
}


def blend(color_a: str, color_b: str, ratio: float) -> str:
    ratio = max(0.0, min(1.0, ratio))
    a = color_a.lstrip("#")
    b = color_b.lstrip("#")
    channels = []
    for i in range(0, 6, 2):
        start = int(a[i : i + 2], 16)
        end = int(b[i : i + 2], 16)
        mixed = int(start + (end - start) * ratio)
        channels.append(f"{mixed:02x}")
    return "#" + "".join(channels)


class TelemetryApp(tk.Tk):
    def __init__(self, client: NTClient):
        super().__init__()
        self.client = client
        self.title("Atlas Reactive Telemetry")
        self.geometry("1360x860")
        self.minsize(1040, 720)
        self.configure(bg=PALETTE["bg"])

        self.value_labels: dict[str, tk.Label] = {}
        self.summary_widgets: dict[str, dict[str, tk.Widget]] = {}
        self.last_refresh_var = tk.StringVar(value="Waiting for NetworkTables...")
        self.connection_banner_var = tk.StringVar(value="Scanning for robot network endpoints")
        self.mousewheel_target: tk.Canvas | None = None
        self._build_ui()
        self.after(REFRESH_MS, self.refresh)

    def _build_ui(self) -> None:
        shell = tk.Frame(self, bg=PALETTE["bg"])
        shell.pack(fill="both", expand=True, padx=self.outer_pad, pady=self.outer_pad)

        header = tk.Frame(
            shell,
            bg=blend(PALETTE["panel_alt"], PALETTE["accent"], 0.16),
            highlightbackground=blend(PALETTE["accent"], PALETTE["border"], 0.55),
            highlightthickness=1,
            padx=22,
            pady=18,
        )
        header.pack(fill="x")

        title_block = tk.Frame(header, bg=header["bg"])
        title_block.pack(side="left", fill="both", expand=True)

        tk.Label(
            title_block,
            text="ATLAS REACTIVE TELEMETRY",
            bg=header["bg"],
            fg=PALETTE["text"],
            font=("Segoe UI Semibold", 22),
        ).pack(anchor="w")
        tk.Label(
            title_block,
            text="LiDAR navigation dashboard tuned for pit-side validation and quick field diagnostics",
            bg=header["bg"],
            fg=blend(PALETTE["muted"], "#ffffff", 0.25),
            font=("Segoe UI", 10),
        ).pack(anchor="w", pady=(6, 0))

        meta_panel = tk.Frame(
            header,
            bg=blend(header["bg"], "#ffffff", 0.04),
            highlightbackground=blend(PALETTE["border"], "#ffffff", 0.15),
            highlightthickness=1,
            padx=18,
            pady=12,
        )
        meta_panel.pack(side="right", anchor="n")

        tk.Label(
            meta_panel,
            text=f"TEAM {self.client.team}",
            bg=meta_panel["bg"],
            fg=PALETTE["info"],
            font=("Segoe UI Semibold", 15),
        ).pack(anchor="e")
        tk.Label(
            meta_panel,
            textvariable=self.last_refresh_var,
            bg=meta_panel["bg"],
            fg=PALETTE["muted"],
            font=("Consolas", 10),
        ).pack(anchor="e", pady=(6, 0))

        banner = tk.Frame(
            shell,
            bg=blend(PALETTE["panel"], PALETTE["info"], 0.08),
            highlightbackground=PALETTE["border"],
            highlightthickness=1,
            padx=16,
            pady=10,
        )
        banner.pack(fill="x", pady=(14, 12))
        self.connection_banner = tk.Label(
            banner,
            textvariable=self.connection_banner_var,
            bg=banner["bg"],
            fg=PALETTE["muted"],
            font=("Segoe UI Semibold", 10),
            anchor="w",
        )
        self.connection_banner.pack(fill="x")

        summary_strip = tk.Frame(shell, bg=PALETTE["bg"])
        summary_strip.pack(fill="x", pady=(0, 14))

        for column, (title, key, description) in enumerate(SUMMARY_FIELDS):
            card = tk.Frame(
                summary_strip,
                bg=PALETTE["panel"],
                highlightbackground=PALETTE["border"],
                highlightthickness=1,
                padx=16,
                pady=14,
            )
            card.grid(
                row=0,
                column=column,
                sticky="nsew",
                padx=(0, 10 if column < len(SUMMARY_FIELDS) - 1 else 0),
            )

            tk.Label(
                card,
                text=title.upper(),
                bg=card["bg"],
                fg=PALETTE["muted"],
                font=("Segoe UI Semibold", 9),
            ).pack(anchor="w")
            value_label = tk.Label(
                card,
                text="--",
                bg=card["bg"],
                fg=PALETTE["text"],
                font=("Segoe UI Semibold", 18),
                pady=8,
            )
            value_label.pack(anchor="w")
            detail_label = tk.Label(
                card,
                text=description,
                bg=card["bg"],
                fg=PALETTE["muted"],
                font=("Segoe UI", 9),
            )
            detail_label.pack(anchor="w")

            self.summary_widgets[key] = {
                "card": card,
                "value": value_label,
                "detail": detail_label,
            }

        for column in range(len(SUMMARY_FIELDS)):
            summary_strip.grid_columnconfigure(column, weight=1)

        body = tk.Frame(shell, bg=PALETTE["bg"])
        body.pack(fill="both", expand=True)

        canvas = tk.Canvas(body, bg=PALETTE["bg"], highlightthickness=0, bd=0)
        canvas.pack(side="left", fill="both", expand=True)
        self.mousewheel_target = canvas

        scrollbar = ttk.Scrollbar(body, orient="vertical", command=canvas.yview)
        scrollbar.pack(side="right", fill="y")
        canvas.configure(yscrollcommand=scrollbar.set)

        sections_host = tk.Frame(canvas, bg=PALETTE["bg"])
        canvas_window = canvas.create_window((0, 0), window=sections_host, anchor="nw")

        sections_host.bind(
            "<Configure>",
            lambda event: canvas.configure(scrollregion=canvas.bbox("all")),
        )
        canvas.bind(
            "<Configure>",
            lambda event: canvas.itemconfigure(canvas_window, width=event.width),
        )
        self.bind_all("<MouseWheel>", self._on_mousewheel)

        section_index = 0
        for title, fields in FIELDS:
            row = section_index // 2
            col = section_index % 2
            accent = SECTION_ACCENTS.get(title, PALETTE["accent"])
            card = tk.Frame(
                sections_host,
                bg=blend(PALETTE["panel"], accent, 0.08),
                highlightbackground=blend(accent, PALETTE["border"], 0.35),
                highlightthickness=1,
                padx=18,
                pady=16,
            )
            card.grid(row=row, column=col, sticky="nsew", padx=8, pady=8)

            tk.Frame(card, bg=accent, height=4).pack(fill="x", pady=(0, 14))
            tk.Label(
                card,
                text=title,
                bg=card["bg"],
                fg=PALETTE["text"],
                font=("Segoe UI Semibold", 14),
            ).pack(anchor="w", pady=(0, 10))

            content = tk.Frame(card, bg=card["bg"])
            content.pack(fill="both", expand=True)
            left_column = tk.Frame(content, bg=card["bg"])
            left_column.pack(side="left", fill="both", expand=True, padx=(0, 8))
            right_column = tk.Frame(content, bg=card["bg"])
            right_column.pack(side="left", fill="both", expand=True, padx=(8, 0))

            midpoint = (len(fields) + 1) // 2
            for i, (label, key, _) in enumerate(fields):
                parent = left_column if i < midpoint else right_column
                row_frame = tk.Frame(parent, bg=card["bg"], pady=4)
                row_frame.pack(fill="x")

                tk.Label(
                    row_frame,
                    text=label,
                    bg=card["bg"],
                    fg=PALETTE["muted"],
                    font=("Segoe UI", 10),
                    anchor="w",
                ).pack(side="left")
                value = tk.Label(
                    row_frame,
                    text="--",
                    bg=blend(card["bg"], "#000000", 0.18),
                    fg=PALETTE["text"],
                    font=("Consolas", 11),
                    padx=10,
                    pady=4,
                    anchor="e",
                )
                value.pack(side="right")
                self.value_labels[key] = value

            section_index += 1

        for col in range(2):
            sections_host.grid_columnconfigure(col, weight=1)

    def refresh(self) -> None:
        values = self._collect_values()
        connected = bool(values["status"]["raw"])
        if connected:
            banner_text = f"CONNECTED via {values['target']['display']} | host seen: {values['host_seen']['display']}"
        else:
            banner_text = f"DISCONNECTED | scanning {values['target']['display']} and fallbacks"

        self.connection_banner_var.set(banner_text)
        self.last_refresh_var.set(time.strftime("Last refresh %H:%M:%S"))

        banner_bg = blend(PALETTE["panel"], PALETTE["good" if connected else "bad"], 0.14)
        self.connection_banner.master.configure(bg=banner_bg)
        self.connection_banner.configure(
            bg=banner_bg,
            fg=PALETTE["text"] if connected else blend(PALETTE["warn"], "#ffffff", 0.3),
        )

        for _, fields in FIELDS:
            for _, key, _ in fields:
                payload = values[key]
                self._set_value(key, payload["display"], payload["raw"], payload["kind"])

        for _, key, _ in SUMMARY_FIELDS:
            payload = values[key]
            self._set_summary_value(key, payload["display"], payload["raw"], payload["kind"])

        self.after(REFRESH_MS, self.refresh)

    def _collect_values(self) -> dict[str, dict[str, object]]:
        connected = self.client.is_connected()
        values: dict[str, dict[str, object]] = {
            "status": {
                "raw": connected,
                "display": "CONNECTED" if connected else "DISCONNECTED",
                "kind": "bool",
            },
            "mode": {
                "raw": self.client.connection_mode,
                "display": self.client.connection_mode,
                "kind": "string",
            },
            "target": {
                "raw": self.client.connection_target,
                "display": self.client.connection_target,
                "kind": "string",
            },
            "host_seen": {
                "raw": self.client.connected_host,
                "display": self.client.connected_host,
                "kind": "string",
            },
            "team": {"raw": self.client.team, "display": str(self.client.team), "kind": "string"},
        }

        for _, fields in FIELDS:
            for _, key, kind in fields:
                if key in values:
                    continue

                if kind == "string":
                    raw = self.client.get_string(key, "--")
                elif kind == "bool":
                    raw = self.client.get_bool(key, False)
                else:
                    raw = self.client.get_number(key, 0.0)

                values[key] = {
                    "raw": raw,
                    "display": self._format_value(key, raw, kind),
                    "kind": kind,
                }

        return values

    def _format_value(self, key: str, raw: object, kind: str) -> str:
        if kind == "string":
            text = str(raw).strip()
            return text or "--"
        if kind == "bool":
            return "TRUE" if bool(raw) else "FALSE"
        return f"{float(raw):.2f}{NUMBER_SUFFIXES.get(key, '')}"

    def _style_for_value(self, key: str, raw: object, kind: str) -> tuple[str, str]:
        if kind == "bool":
            return self._bool_style(key, bool(raw))
        if kind == "string":
            return self._string_style(key, str(raw))
        return self._number_style(key, float(raw))

    def _bool_style(self, key: str, value: bool) -> tuple[str, str]:
        polarity = BOOLEAN_POLARITY.get(key, "neutral")
        chip_bg = blend(PALETTE["panel_alt"], "#000000", 0.15)

        if not value:
            if polarity == "good":
                return blend(PALETTE["panel"], PALETTE["bad"], 0.18), PALETTE["bad"]
            return chip_bg, PALETTE["muted"]

        if polarity == "good":
            return blend(PALETTE["panel"], PALETTE["good"], 0.18), PALETTE["good"]
        if polarity == "bad":
            return blend(PALETTE["panel"], PALETTE["bad"], 0.18), PALETTE["bad"]
        if polarity == "warn":
            return blend(PALETTE["panel"], PALETTE["warn"], 0.18), PALETTE["warn"]
        if polarity == "info":
            return blend(PALETTE["panel"], PALETTE["info"], 0.18), PALETTE["info"]
        return chip_bg, PALETTE["text"]

    def _string_style(self, key: str, value: str) -> tuple[str, str]:
        text = value.upper()
        if key == "Telemetry/Reactive/State":
            if any(token in text for token in ("TURN", "AVOID", "SEARCH")):
                return blend(PALETTE["panel"], PALETTE["warn"], 0.16), PALETTE["warn"]
            if any(token in text for token in ("STOP", "BLOCK", "DEAD")):
                return blend(PALETTE["panel"], PALETTE["bad"], 0.16), PALETTE["bad"]
            if any(token in text for token in ("FORWARD", "TRACK", "FOLLOW", "CENTER")):
                return blend(PALETTE["panel"], PALETTE["good"], 0.16), PALETTE["good"]
            return blend(PALETTE["panel"], PALETTE["accent"], 0.16), PALETTE["accent"]

        return blend(PALETTE["panel_alt"], "#000000", 0.2), PALETTE["text"]

    def _number_style(self, key: str, value: float) -> tuple[str, str]:
        neutral = (blend(PALETTE["panel_alt"], "#000000", 0.2), PALETTE["text"])

        if key == "Telemetry/Reactive/Front Median (mm)":
            if value < 350:
                return blend(PALETTE["panel"], PALETTE["bad"], 0.18), PALETTE["bad"]
            if value < 650:
                return blend(PALETTE["panel"], PALETTE["warn"], 0.18), PALETTE["warn"]
            return blend(PALETTE["panel"], PALETTE["good"], 0.18), PALETTE["good"]

        if key in {"Telemetry/Reactive/Angular Error", "Telemetry/Reactive/Lateral Error"}:
            magnitude = abs(value)
            if magnitude > 20:
                return blend(PALETTE["panel"], PALETTE["bad"], 0.18), PALETTE["bad"]
            if magnitude > 8:
                return blend(PALETTE["panel"], PALETTE["warn"], 0.18), PALETTE["warn"]
            return blend(PALETTE["panel"], PALETTE["good"], 0.18), PALETTE["good"]

        if key == "Telemetry/Reactive/Rotation Command":
            magnitude = abs(value)
            if magnitude > 0.7:
                return blend(PALETTE["panel"], PALETTE["bad"], 0.18), PALETTE["bad"]
            if magnitude > 0.3:
                return blend(PALETTE["panel"], PALETTE["warn"], 0.18), PALETTE["warn"]
            return blend(PALETTE["panel"], PALETTE["info"], 0.18), PALETTE["info"]

        if key == "Telemetry/Reactive/Stable Scan Cycles":
            if value < 2:
                return blend(PALETTE["panel"], PALETTE["bad"], 0.18), PALETTE["bad"]
            if value < 5:
                return blend(PALETTE["panel"], PALETTE["warn"], 0.18), PALETTE["warn"]
            return blend(PALETTE["panel"], PALETTE["good"], 0.18), PALETTE["good"]

        return neutral

    def _set_summary_value(self, key: str, value: str, raw: object, kind: str) -> None:
        widgets = self.summary_widgets.get(key)
        if not widgets:
            return

        bg, fg = self._style_for_value(key, raw, kind)
        card = widgets["card"]
        value_label = widgets["value"]
        detail_label = widgets["detail"]

        card.configure(bg=bg, highlightbackground=blend(fg, PALETTE["border"], 0.45))
        value_label.configure(bg=bg, fg=fg, text=value)
        detail_label.configure(bg=bg, fg=blend(PALETTE["text"], fg, 0.18))

    def _set_value(self, key: str, value: str, raw: object, kind: str) -> None:
        label = self.value_labels.get(key)
        if label:
            bg, fg = self._style_for_value(key, raw, kind)
            label.configure(text=value, bg=bg, fg=fg)

    def _on_mousewheel(self, event: tk.Event) -> None:
        if self.mousewheel_target is not None:
            self.mousewheel_target.yview_scroll(int(-event.delta / 120), "units")


class ModernTelemetryApp(tk.Tk):
    def __init__(self, client: NTClient):
        super().__init__()
        self.client = client
        self.title("Atlas Reactive Telemetry")
        self.configure(bg=PALETTE["bg"])

        screen_w = self.winfo_screenwidth()
        screen_h = self.winfo_screenheight()
        self.compact = screen_h <= 1100
        window_w = min(max(1280, screen_w - 70), 1500)
        window_h = min(max(760, screen_h - 120), 900)
        self.geometry(f"{window_w}x{window_h}+20+20")
        self.minsize(1180, 700)

        self.outer_pad = 8 if self.compact else 18
        self.gap = 6 if self.compact else 10
        self.header_pad_x = 16 if self.compact else 24
        self.header_pad_y = 10 if self.compact else 18
        self.card_inner_pad = (12, 10) if self.compact else (18, 16)
        self.card_header_pad_x = 12 if self.compact else 18
        self.card_header_pad_y = 10 if self.compact else 16
        self.heading_canvas_height = 170 if self.compact else 310
        self.perception_canvas_height = 135 if self.compact else 260
        self.command_bar_height = 18 if self.compact else 34
        self.header_title_size = 18 if self.compact else 24
        self.overview_value_size = 16 if self.compact else 22
        self.hero_state_size = 17 if self.compact else 24

        self.header_status_var = tk.StringVar(value="Scanning robot network")
        self.last_refresh_var = tk.StringVar(value="Waiting for NetworkTables...")

        self.overview_widgets: dict[str, dict[str, tk.Widget]] = {}
        self.health_widgets: dict[str, dict[str, tk.Widget]] = {}
        self.heading_metric_widgets: dict[str, tk.Label] = {}
        self.perception_metric_widgets: dict[str, tk.Label] = {}
        self.flag_widgets: dict[str, tk.Label] = {}
        self.state_detail_widgets: dict[str, tk.Label] = {}
        self.state_metric_widgets: dict[str, tk.Label] = {}
        self.network_widgets: dict[str, tk.Label] = {}
        self.encoder_widgets: dict[str, tk.Label] = {}
        self.command_widgets: dict[str, dict[str, tk.Widget]] = {}

        self.state_primary: tk.Label | None = None
        self.state_secondary: tk.Label | None = None
        self.heading_canvas: tk.Canvas | None = None
        self.perception_canvas: tk.Canvas | None = None
        self.header_panel: tk.Frame | None = None

        self._build_ui()
        self.after(0, self._fit_window)
        self.after(REFRESH_MS, self.refresh)

    def _build_ui(self) -> None:
        shell = tk.Frame(self, bg=PALETTE["bg"])
        shell.pack(fill="both", expand=True, padx=18, pady=18)

        self._build_header(shell)
        self._build_overview(shell)

        content = tk.Frame(shell, bg=PALETTE["bg"])
        content.pack(fill="both", expand=True, pady=(10 if self.compact else 14, 0))
        content.grid_columnconfigure(0, weight=4, uniform="main")
        content.grid_columnconfigure(1, weight=5, uniform="main")
        content.grid_columnconfigure(2, weight=4, uniform="main")

        left_column = tk.Frame(content, bg=PALETTE["bg"])
        left_column.grid(row=0, column=0, sticky="nsew", padx=(0, self.gap))
        left_column.grid_rowconfigure(0, weight=3)
        left_column.grid_rowconfigure(1, weight=1)

        center_column = tk.Frame(content, bg=PALETTE["bg"])
        center_column.grid(row=0, column=1, sticky="nsew", padx=self.gap)
        center_column.grid_rowconfigure(0, weight=3)
        center_column.grid_rowconfigure(1, weight=1)

        right_column = tk.Frame(content, bg=PALETTE["bg"])
        right_column.grid(row=0, column=2, sticky="nsew", padx=(self.gap, 0))
        right_column.grid_rowconfigure(0, weight=2)
        right_column.grid_rowconfigure(1, weight=2)
        right_column.grid_rowconfigure(2, weight=1)

        self._build_heading_card(left_column).grid(row=0, column=0, sticky="nsew", pady=(0, self.gap))
        self._build_commands_card(left_column).grid(row=1, column=0, sticky="nsew")

        self._build_perception_card(center_column).grid(row=0, column=0, sticky="nsew", pady=(0, self.gap))
        self._build_encoders_card(center_column).grid(row=1, column=0, sticky="nsew")

        self._build_systems_card(right_column).grid(row=0, column=0, sticky="nsew", pady=(0, self.gap))
        self._build_state_card(right_column).grid(row=1, column=0, sticky="nsew", pady=(0, self.gap))
        self._build_network_card(right_column).grid(row=2, column=0, sticky="nsew")

    def _build_header(self, parent: tk.Frame) -> None:
        header_bg = blend(PALETTE["panel_alt"], PALETTE["cyan"], 0.08)
        header = tk.Frame(
            parent,
            bg=header_bg,
            highlightbackground=blend(PALETTE["cyan"], PALETTE["border"], 0.5),
            highlightthickness=1,
            padx=self.header_pad_x,
            pady=self.header_pad_y,
        )
        header.pack(fill="x")
        self.header_panel = header

        left = tk.Frame(header, bg=header_bg)
        left.pack(side="left", fill="both", expand=True)
        right = tk.Frame(
            header,
            bg=blend(header_bg, "#ffffff", 0.03),
            padx=14 if self.compact else 18,
            pady=10 if self.compact else 12,
        )
        right.pack(side="right", anchor="n")

        tk.Label(
            left,
            text="ATLAS NAVIGATION CORE",
            bg=header_bg,
            fg=PALETTE["text"],
            font=("Segoe UI Semibold", self.header_title_size),
        ).pack(anchor="w")
        tk.Label(
            left,
            text="Reactive LiDAR telemetry with a cockpit-style single-screen layout",
            bg=header_bg,
            fg=PALETTE["muted"],
            font=("Segoe UI", 9 if self.compact else 10),
        ).pack(anchor="w", pady=(3, 6 if self.compact else 10))
        tk.Label(
            left,
            textvariable=self.header_status_var,
            bg=header_bg,
            fg=PALETTE["cyan"],
            font=("Consolas", 10 if self.compact else 11),
        ).pack(anchor="w")

        tk.Label(
            right,
            text=f"TEAM {self.client.team}",
            bg=right["bg"],
            fg=PALETTE["cyan"],
            font=("Segoe UI Semibold", 15 if self.compact else 17),
        ).pack(anchor="e")
        tk.Label(
            right,
            textvariable=self.last_refresh_var,
            bg=right["bg"],
            fg=PALETTE["muted"],
            font=("Consolas", 9 if self.compact else 10),
        ).pack(anchor="e", pady=(6, 0))

    def _build_overview(self, parent: tk.Frame) -> None:
        row = tk.Frame(parent, bg=PALETTE["bg"])
        row.pack(fill="x", pady=(10 if self.compact else 14, 0))

        for column, (title, key) in enumerate(OVERVIEW_FIELDS):
            accent = PALETTE["cyan"] if column == 0 else PALETTE["blue"]
            card, body = self._make_card(
                row,
                title,
                "overview",
                accent,
                inner_pad=(12, 10) if self.compact else (16, 14),
            )
            card.grid(
                row=0,
                column=column,
                sticky="nsew",
                padx=(0, 10 if column < len(OVERVIEW_FIELDS) - 1 else 0),
            )

            value = tk.Label(
                body,
                text="--",
                bg=body["bg"],
                fg=PALETTE["text"],
                font=("Segoe UI Semibold", self.overview_value_size),
            )
            value.pack(anchor="w")
            detail = tk.Label(
                body,
                text="",
                bg=body["bg"],
                fg=PALETTE["muted"],
                font=("Segoe UI", 8 if self.compact else 9),
            )
            detail.pack(anchor="w", pady=(4, 0))
            self.overview_widgets[key] = {"card": card, "body": body, "value": value, "detail": detail}

        for column in range(len(OVERVIEW_FIELDS)):
            row.grid_columnconfigure(column, weight=1)

    def _build_heading_card(self, parent: tk.Frame) -> tk.Frame:
        card, body = self._make_card(parent, "Gyro / Heading", "yaw alignment", PALETTE["magenta"])
        self.heading_canvas = tk.Canvas(
            body,
            bg=body["bg"],
            highlightthickness=0,
            bd=0,
            height=self.heading_canvas_height,
        )
        self.heading_canvas.pack(fill="both", expand=True)

        footer = tk.Frame(body, bg=body["bg"])
        footer.pack(fill="x", pady=(8 if self.compact else 12, 0))
        for index, (title, key) in enumerate(HEADING_METRIC_FIELDS):
            tile = self._make_metric_tile(footer, title, compact=True)
            tile.grid(
                row=index // 2,
                column=index % 2,
                sticky="nsew",
                padx=(0 if index % 2 == 0 else self.gap, 0),
                pady=(0 if index < 2 else self.gap, 0),
            )
            self.heading_metric_widgets[key] = tile.children["value"]

        footer.grid_columnconfigure(0, weight=1)
        footer.grid_columnconfigure(1, weight=1)
        return card

    def _build_perception_card(self, parent: tk.Frame) -> tk.Frame:
        card, body = self._make_card(parent, "Perception", "corridor sensing", PALETTE["cyan"])
        self.perception_canvas = tk.Canvas(
            body,
            bg=body["bg"],
            highlightthickness=0,
            bd=0,
            height=self.perception_canvas_height,
        )
        self.perception_canvas.pack(fill="both", expand=True)

        metrics = tk.Frame(body, bg=body["bg"])
        metrics.pack(fill="x", pady=(8 if self.compact else 10, 0))
        for column, (title, key) in enumerate(PERCEPTION_METRIC_FIELDS):
            tile = self._make_metric_tile(metrics, title, compact=True)
            tile.grid(
                row=0,
                column=column,
                sticky="nsew",
                padx=(0, self.gap if column < len(PERCEPTION_METRIC_FIELDS) - 1 else 0),
            )
            metrics.grid_columnconfigure(column, weight=1)
            self.perception_metric_widgets[key] = tile.children["value"]

        flags = tk.Frame(body, bg=body["bg"])
        flags.pack(fill="x", pady=(8 if self.compact else 12, 0))
        for column, (title, key) in enumerate(PERCEPTION_FLAG_FIELDS):
            label = tk.Label(
                flags,
                text=title,
                bg=blend(body["bg"], "#000000", 0.18),
                fg=PALETTE["muted"],
                font=("Segoe UI Semibold", 9),
                padx=8 if self.compact else 10,
                pady=5 if self.compact else 6,
            )
            label.grid(
                row=0,
                column=column,
                sticky="nsew",
                padx=(0, self.gap if column < len(PERCEPTION_FLAG_FIELDS) - 1 else 0),
            )
            flags.grid_columnconfigure(column, weight=1)
            self.flag_widgets[key] = label
        return card

    def _build_commands_card(self, parent: tk.Frame) -> tk.Frame:
        card, body = self._make_card(parent, "Commands", "drive outputs", PALETTE["good"])
        for index, (title, key, accent) in enumerate(COMMAND_FIELDS):
            row = tk.Frame(body, bg=body["bg"])
            row.pack(fill="x", pady=(0, (8 if self.compact else 12) if index < len(COMMAND_FIELDS) - 1 else 0))

            head = tk.Frame(row, bg=row["bg"])
            head.pack(fill="x")
            tk.Label(
                head,
                text=title,
                bg=head["bg"],
                fg=PALETTE["text"],
                font=("Segoe UI Semibold", 10),
            ).pack(side="left")
            value = tk.Label(
                head,
                text="0.00",
                bg=head["bg"],
                fg=accent,
                font=("Consolas", 10 if self.compact else 11),
            )
            value.pack(side="right")

            canvas = tk.Canvas(
                row,
                bg=row["bg"],
                highlightthickness=0,
                bd=0,
                height=self.command_bar_height,
            )
            canvas.pack(fill="x", pady=(4 if self.compact else 6, 0))
            self.command_widgets[key] = {"value": value, "canvas": canvas, "accent": accent}
        return card

    def _build_encoders_card(self, parent: tk.Frame) -> tk.Frame:
        card, body = self._make_card(parent, "Encoders", "translation feedback", PALETTE["blue"])
        grid = tk.Frame(body, bg=body["bg"])
        grid.pack(fill="both", expand=True)
        for index, (title, key) in enumerate(ENCODER_FIELDS):
            tile = self._make_metric_tile(grid, title)
            tile.grid(
                row=index // 2,
                column=index % 2,
                sticky="nsew",
                padx=(0 if index % 2 == 0 else self.gap, 0),
                pady=(0 if index < 2 else self.gap, 0),
            )
            self.encoder_widgets[key] = tile.children["value"]

        grid.grid_columnconfigure(0, weight=1)
        grid.grid_columnconfigure(1, weight=1)
        return card

    def _build_systems_card(self, parent: tk.Frame) -> tk.Frame:
        card, body = self._make_card(parent, "Systems Health", "critical subsystems", PALETTE["cyan"])
        grid = tk.Frame(body, bg=body["bg"])
        grid.pack(fill="both", expand=True)
        for index, (title, key) in enumerate(SYSTEM_HEALTH_FIELDS):
            cell = tk.Frame(
                grid,
                bg=blend(body["bg"], "#000000", 0.16),
                highlightbackground=blend(PALETTE["border"], "#ffffff", 0.1),
                highlightthickness=1,
                padx=10 if self.compact else 12,
                pady=8 if self.compact else 10,
            )
            cell.grid(
                row=index // 2,
                column=index % 2,
                sticky="nsew",
                padx=(0 if index % 2 == 0 else self.gap, 0),
                pady=(0 if index < 4 else self.gap, 0),
            )
            tk.Label(
                cell,
                text=title.upper(),
                bg=cell["bg"],
                fg=PALETTE["muted"],
                font=("Segoe UI Semibold", 7 if self.compact else 8),
            ).pack(anchor="w")
            value = tk.Label(
                cell,
                text="--",
                bg=cell["bg"],
                fg=PALETTE["text"],
                font=("Segoe UI Semibold", 11 if self.compact else 13),
                pady=3 if self.compact else 4,
            )
            value.pack(anchor="w")
            self.health_widgets[key] = {"cell": cell, "value": value}

        grid.grid_columnconfigure(0, weight=1)
        grid.grid_columnconfigure(1, weight=1)
        return card

    def _build_state_card(self, parent: tk.Frame) -> tk.Frame:
        card, body = self._make_card(parent, "Reactive State", "planner internals", PALETTE["magenta"])

        hero = tk.Frame(
            body,
            bg=blend(body["bg"], "#000000", 0.16),
            highlightbackground=blend(PALETTE["magenta"], PALETTE["border"], 0.45),
            highlightthickness=1,
            padx=12 if self.compact else 16,
            pady=10 if self.compact else 14,
        )
        hero.pack(fill="x")
        self.state_primary = tk.Label(
            hero,
            text="--",
            bg=hero["bg"],
            fg=PALETTE["text"],
            font=("Segoe UI Semibold", self.hero_state_size),
        )
        self.state_primary.pack(anchor="w")
        self.state_secondary = tk.Label(
            hero,
            text="Planner awaiting telemetry",
            bg=hero["bg"],
            fg=PALETTE["muted"],
            font=("Segoe UI", 9 if self.compact else 10),
        )
        self.state_secondary.pack(anchor="w", pady=(6, 0))

        details = tk.Frame(body, bg=body["bg"])
        details.pack(fill="x", pady=(8 if self.compact else 12, 0))
        for title, key in STATE_DETAIL_FIELDS:
            row = tk.Frame(details, bg=details["bg"])
            row.pack(fill="x", pady=2 if self.compact else 3)
            tk.Label(
                row,
                text=title,
                bg=row["bg"],
                fg=PALETTE["muted"],
                font=("Segoe UI", 9 if self.compact else 10),
            ).pack(side="left")
            value = tk.Label(
                row,
                text="--",
                bg=blend(body["bg"], "#000000", 0.18),
                fg=PALETTE["text"],
                font=("Consolas", 9 if self.compact else 10),
                padx=8 if self.compact else 10,
                pady=3 if self.compact else 4,
            )
            value.pack(side="right")
            self.state_detail_widgets[key] = value

        metrics = tk.Frame(body, bg=body["bg"])
        metrics.pack(fill="x", pady=(8 if self.compact else 14, 0))
        for index, (title, key) in enumerate(STATE_METRIC_FIELDS):
            tile = self._make_metric_tile(metrics, title)
            tile.grid(row=0, column=index, sticky="nsew", padx=(0, self.gap if index == 0 else 0))
            metrics.grid_columnconfigure(index, weight=1)
            self.state_metric_widgets[key] = tile.children["value"]

        return card

    def _build_network_card(self, parent: tk.Frame) -> tk.Frame:
        card, body = self._make_card(parent, "Network Route", "connection path", PALETTE["blue"])
        for title, key in NETWORK_FIELDS:
            row = tk.Frame(body, bg=body["bg"])
            row.pack(fill="x", pady=2 if self.compact else 3)
            tk.Label(
                row,
                text=title,
                bg=row["bg"],
                fg=PALETTE["muted"],
                font=("Segoe UI", 9 if self.compact else 10),
            ).pack(side="left")
            value = tk.Label(
                row,
                text="--",
                bg=blend(body["bg"], "#000000", 0.18),
                fg=PALETTE["text"],
                font=("Consolas", 9 if self.compact else 10),
                padx=8 if self.compact else 10,
                pady=3 if self.compact else 4,
            )
            value.pack(side="right")
            self.network_widgets[key] = value
        return card

    def _make_card(
        self,
        parent: tk.Widget,
        title: str,
        subtitle: str,
        accent: str,
        inner_pad: tuple[int, int] | None = None,
    ) -> tuple[tk.Frame, tk.Frame]:
        if inner_pad is None:
            inner_pad = self.card_inner_pad
        card_bg = blend(PALETTE["panel"], accent, 0.07)
        card = tk.Frame(
            parent,
            bg=card_bg,
            highlightbackground=blend(accent, PALETTE["border"], 0.45),
            highlightthickness=1,
        )
        header = tk.Frame(card, bg=card_bg)
        header.pack(fill="x", padx=self.card_header_pad_x, pady=(self.card_header_pad_y, 0))
        tk.Frame(header, bg=accent, height=4, width=48).pack(anchor="w")
        tk.Label(
            header,
            text=title,
            bg=card_bg,
            fg=PALETTE["text"],
            font=("Segoe UI Semibold", 13 if self.compact else 14),
        ).pack(anchor="w", pady=(7 if self.compact else 10, 0))
        tk.Label(
            header,
            text=subtitle.upper(),
            bg=card_bg,
            fg=PALETTE["muted"],
            font=("Segoe UI Semibold", 7 if self.compact else 8),
        ).pack(anchor="w", pady=(2, 0))
        body = tk.Frame(card, bg=card_bg)
        body.pack(fill="both", expand=True, padx=inner_pad[0], pady=((10 if self.compact else 14), inner_pad[1]))
        return card, body

    def _make_metric_tile(self, parent: tk.Widget, title: str, compact: bool = False) -> tk.Frame:
        tile = tk.Frame(
            parent,
            name=f"tile_{len(parent.children)}",
            bg=blend(PALETTE["panel_alt"], "#000000", 0.12),
            highlightbackground=blend(PALETTE["border"], "#ffffff", 0.08),
            highlightthickness=1,
            padx=10 if self.compact else 12,
            pady=8 if self.compact else (10 if not compact else 8),
        )
        tk.Label(
            tile,
            text=title.upper(),
            bg=tile["bg"],
            fg=PALETTE["muted"],
            font=("Segoe UI Semibold", 7 if self.compact else (8 if compact else 9)),
        ).pack(anchor="w")
        value = tk.Label(
            tile,
            name="value",
            text="--",
            bg=tile["bg"],
            fg=PALETTE["text"],
            font=("Consolas", 10 if self.compact else (11 if compact else 12)),
            pady=3 if self.compact else 4,
        )
        value.pack(anchor="w")
        return tile

    def refresh(self) -> None:
        values = self._collect_values()
        self._update_header(values)
        self._update_overview(values)
        self._update_systems(values)
        self._update_heading(values)
        self._update_perception(values)
        self._update_commands(values)
        self._update_state(values)
        self._update_network(values)
        self._update_encoders(values)
        self.after(REFRESH_MS, self.refresh)

    def _collect_values(self) -> dict[str, object]:
        values: dict[str, object] = {
            "status": self.client.is_connected(),
            "mode": self.client.connection_mode,
            "target": self.client.connection_target,
            "host_seen": self.client.connected_host,
            "team": str(self.client.team),
        }

        for key, kind in FIELD_KINDS.items():
            if key in values:
                continue
            if kind == "string":
                values[key] = self.client.get_string(key, "--")
            elif kind == "bool":
                values[key] = self.client.get_bool(key, False)
            else:
                values[key] = self.client.get_number(key, 0.0)
        return values

    def _update_header(self, values: dict[str, object]) -> None:
        connected = bool(values["status"])
        if connected:
            text = f"ONLINE  |  {values['target']}  |  host {values['host_seen']}"
            color = PALETTE["good"]
        else:
            text = f"OFFLINE  |  scanning {values['target']} and robot fallbacks"
            color = PALETTE["warn"]

        self.header_status_var.set(text)
        self.last_refresh_var.set(time.strftime("Last refresh %H:%M:%S"))
        if self.header_panel is not None:
            self.header_panel.configure(highlightbackground=blend(color, PALETTE["border"], 0.45))

    def _update_overview(self, values: dict[str, object]) -> None:
        for _, key in OVERVIEW_FIELDS:
            widgets = self.overview_widgets[key]
            display = self._format_value(key, values[key], short=True)
            bg, fg = self._style_for_value(key, values[key])

            if key == "status":
                detail = f"Target {values['target']}"
            elif key == "Telemetry/Robot/Enabled":
                detail = "Robot enabled" if values[key] else "Robot disabled"
            elif key == "Telemetry/Reactive/Front Median (mm)":
                detail = self._front_detail(float(values[key]))
            else:
                detail = str(values["Debug/Reactive/Decision"]).strip() or "No decision"

            widgets["card"].configure(bg=bg, highlightbackground=blend(fg, PALETTE["border"], 0.42))
            widgets["body"].configure(bg=bg)
            widgets["value"].configure(bg=bg, fg=fg, text=display)
            widgets["detail"].configure(bg=bg, fg=blend(PALETTE["text"], fg, 0.16), text=detail)

    def _update_systems(self, values: dict[str, object]) -> None:
        for _, key in SYSTEM_HEALTH_FIELDS:
            widgets = self.health_widgets[key]
            bg, fg = self._style_for_value(key, values[key])
            widgets["cell"].configure(bg=bg, highlightbackground=blend(fg, PALETTE["border"], 0.42))
            widgets["value"].configure(bg=bg, fg=fg, text=self._format_bool_label(key, bool(values[key])))

    def _update_heading(self, values: dict[str, object]) -> None:
        if self.heading_canvas is not None:
            self._draw_heading_gauge(
                self.heading_canvas,
                float(values["Telemetry/Reactive/Pose Heading (deg)"]),
                float(values["Telemetry/Reactive/Target Yaw (deg)"]),
            )

        for _, key in HEADING_METRIC_FIELDS:
            label = self.heading_metric_widgets[key]
            bg, fg = self._style_for_value(key, values[key])
            title_label = next(widget for name, widget in label.master.children.items() if name != "value")
            label.master.configure(bg=bg, highlightbackground=blend(fg, PALETTE["border"], 0.38))
            title_label.configure(bg=bg)
            label.configure(bg=bg, fg=fg, text=self._format_value(key, values[key]))

    def _update_perception(self, values: dict[str, object]) -> None:
        if self.perception_canvas is not None:
            self._draw_perception_scene(self.perception_canvas, values)

        for _, key in PERCEPTION_METRIC_FIELDS:
            label = self.perception_metric_widgets[key]
            bg, fg = self._style_for_value(key, values[key])
            title_label = next(widget for name, widget in label.master.children.items() if name != "value")
            label.master.configure(bg=bg, highlightbackground=blend(fg, PALETTE["border"], 0.38))
            title_label.configure(bg=bg)
            label.configure(bg=bg, fg=fg, text=self._format_value(key, values[key]))

        for title, key in PERCEPTION_FLAG_FIELDS:
            label = self.flag_widgets[key]
            bg, fg = self._style_for_value(key, values[key])
            label.configure(bg=bg, fg=fg, text=f"{title}  {self._format_bool_label(key, bool(values[key]))}")

    def _update_commands(self, values: dict[str, object]) -> None:
        for _, key, accent in COMMAND_FIELDS:
            widgets = self.command_widgets[key]
            value = float(values[key])
            widgets["value"].configure(text=f"{value:.2f}")
            self._draw_command_bar(widgets["canvas"], value, accent)

    def _update_state(self, values: dict[str, object]) -> None:
        if self.state_primary is not None and self.state_secondary is not None:
            state_bg, state_fg = self._style_for_value("Telemetry/Reactive/State", values["Telemetry/Reactive/State"])
            self.state_primary.master.configure(bg=state_bg, highlightbackground=blend(state_fg, PALETTE["border"], 0.42))
            self.state_primary.configure(
                bg=state_bg,
                fg=state_fg,
                text=str(values["Telemetry/Reactive/State"]).upper() or "--",
            )
            self.state_secondary.configure(
                bg=state_bg,
                fg=blend(PALETTE["text"], state_fg, 0.14),
                text=f"Decision stream: {str(values['Debug/Reactive/Decision']).strip() or '--'}",
            )

        for _, key in STATE_DETAIL_FIELDS:
            self.state_detail_widgets[key].configure(text=str(values[key]).strip() or "--")

        for _, key in STATE_METRIC_FIELDS:
            label = self.state_metric_widgets[key]
            bg, fg = self._style_for_value(key, values[key])
            title_label = next(widget for name, widget in label.master.children.items() if name != "value")
            label.master.configure(bg=bg, highlightbackground=blend(fg, PALETTE["border"], 0.38))
            title_label.configure(bg=bg)
            label.configure(bg=bg, fg=fg, text=self._format_value(key, values[key]))

    def _update_network(self, values: dict[str, object]) -> None:
        for _, key in NETWORK_FIELDS:
            self.network_widgets[key].configure(text=str(values[key]))

    def _update_encoders(self, values: dict[str, object]) -> None:
        for _, key in ENCODER_FIELDS:
            label = self.encoder_widgets[key]
            bg, fg = self._style_for_value(key, values[key])
            title_label = next(widget for name, widget in label.master.children.items() if name != "value")
            label.master.configure(bg=bg, highlightbackground=blend(fg, PALETTE["border"], 0.38))
            title_label.configure(bg=bg)
            label.configure(bg=bg, fg=fg, text=self._format_value(key, values[key]))

    def _draw_heading_gauge(self, canvas: tk.Canvas, heading: float, target: float) -> None:
        canvas.delete("all")
        width = max(canvas.winfo_width(), 10)
        height = max(canvas.winfo_height(), 10)
        center_x = width / 2
        center_y = height / 2 - 6
        radius = min(width, height) * 0.34

        canvas.create_oval(
            center_x - radius - 14,
            center_y - radius - 14,
            center_x + radius + 14,
            center_y + radius + 14,
            outline=blend(PALETTE["cyan"], PALETTE["panel"], 0.78),
            width=1,
        )
        canvas.create_oval(
            center_x - radius,
            center_y - radius,
            center_x + radius,
            center_y + radius,
            outline=blend(PALETTE["text"], PALETTE["panel"], 0.5),
            width=2,
        )

        for deg in range(0, 360, 10):
            major = deg % 45 == 0
            outer = radius + (3 if major else 0)
            inner = radius - (18 if major else 10)
            x1, y1 = self._polar_point(center_x, center_y, inner, deg)
            x2, y2 = self._polar_point(center_x, center_y, outer, deg)
            canvas.create_line(
                x1,
                y1,
                x2,
                y2,
                fill=blend(PALETTE["text"], PALETTE["panel"], 0.22 if major else 0.72),
                width=2 if major else 1,
            )
            if major:
                label_x, label_y = self._polar_point(center_x, center_y, radius + 24, deg)
                canvas.create_text(label_x, label_y, text=str(deg), fill=PALETTE["muted"], font=("Consolas", 8))

        target_x, target_y = self._polar_point(center_x, center_y, radius - 4, target)
        canvas.create_oval(target_x - 5, target_y - 5, target_x + 5, target_y + 5, fill=PALETTE["cyan"], outline="")
        canvas.create_line(center_x, center_y, target_x, target_y, fill=blend(PALETTE["cyan"], "#ffffff", 0.25), width=2)

        head_x, head_y = self._polar_point(center_x, center_y, radius - 28, heading)
        canvas.create_line(center_x, center_y, head_x, head_y, fill=PALETTE["magenta"], width=4, capstyle=tk.ROUND)
        canvas.create_oval(center_x - 7, center_y - 7, center_x + 7, center_y + 7, fill=PALETTE["panel"], outline=PALETTE["text"], width=1)
        canvas.create_text(center_x, height - 34, text=f"{heading:.1f}", fill=PALETTE["text"], font=("Consolas", 20))

    def _draw_perception_scene(self, canvas: tk.Canvas, values: dict[str, object]) -> None:
        canvas.delete("all")
        width = max(canvas.winfo_width(), 10)
        height = max(canvas.winfo_height(), 10)
        card_bg = canvas["bg"]
        stroke = blend(PALETTE["border"], "#ffffff", 0.08)
        center_x = width / 2
        base_y = height - 58
        top_y = 34
        lane_left = width * 0.18
        lane_right = width * 0.82

        for offset in range(0, int(width), 34):
            canvas.create_line(offset, 0, offset, height, fill=blend(card_bg, PALETTE["cyan"], 0.06))
        for offset in range(0, int(height), 34):
            canvas.create_line(0, offset, width, offset, fill=blend(card_bg, PALETTE["cyan"], 0.06))

        canvas.create_polygon(
            lane_left,
            top_y,
            lane_right,
            top_y,
            width - 54,
            base_y,
            54,
            base_y,
            outline=stroke,
            fill="",
            width=2,
        )

        robot_w = 42
        robot_h = 58
        canvas.create_rectangle(
            center_x - robot_w / 2,
            base_y - robot_h,
            center_x + robot_w / 2,
            base_y,
            outline=PALETTE["text"],
            fill=blend(PALETTE["panel_alt"], PALETTE["cyan"], 0.08),
            width=2,
        )

        front = float(values["Telemetry/Reactive/Front Median (mm)"])
        left_wall = float(values["Telemetry/Reactive/Left Wall Median (mm)"])
        right_wall = float(values["Telemetry/Reactive/Right Wall Median (mm)"])
        left_open = float(values["Telemetry/Reactive/Left Open Median (mm)"])
        right_open = float(values["Telemetry/Reactive/Right Open Median (mm)"])

        front_len = self._scale_distance(front, 0, 1800, 28, base_y - top_y - robot_h - 18)
        left_len = self._scale_distance(left_wall, 0, 1400, 20, width * 0.24)
        right_len = self._scale_distance(right_wall, 0, 1400, 20, width * 0.24)
        left_open_len = self._scale_distance(left_open, 0, 2000, 14, width * 0.26)
        right_open_len = self._scale_distance(right_open, 0, 2000, 14, width * 0.26)

        front_color = self._style_for_value("Telemetry/Reactive/Front Median (mm)", front)[1]
        left_color = self._style_for_value("Telemetry/Reactive/Left Wall Median (mm)", left_wall)[1]
        right_color = self._style_for_value("Telemetry/Reactive/Right Wall Median (mm)", right_wall)[1]

        canvas.create_line(center_x, base_y - robot_h, center_x, base_y - robot_h - front_len, fill=front_color, width=12, capstyle=tk.ROUND)
        canvas.create_text(center_x, top_y + 8, text=f"FRONT {front:.0f} mm", fill=front_color, font=("Consolas", 10))
        canvas.create_line(center_x - 22, base_y - 18, center_x - 22 - left_len, base_y - 18, fill=left_color, width=10, capstyle=tk.ROUND)
        canvas.create_line(center_x + 22, base_y - 18, center_x + 22 + right_len, base_y - 18, fill=right_color, width=10, capstyle=tk.ROUND)
        canvas.create_line(center_x - 22, base_y - 72, center_x - 22 - left_open_len, base_y - 72, fill=PALETTE["cyan"], width=5, capstyle=tk.ROUND)
        canvas.create_line(center_x + 22, base_y - 72, center_x + 22 + right_open_len, base_y - 72, fill=PALETTE["cyan"], width=5, capstyle=tk.ROUND)

        canvas.create_text(86, base_y - 30, text=f"L WALL {left_wall:.0f}", fill=left_color, font=("Consolas", 9))
        canvas.create_text(width - 86, base_y - 30, text=f"R WALL {right_wall:.0f}", fill=right_color, font=("Consolas", 9))
        canvas.create_text(84, base_y - 88, text=f"L OPEN {left_open:.0f}", fill=PALETTE["cyan"], font=("Consolas", 9))
        canvas.create_text(width - 84, base_y - 88, text=f"R OPEN {right_open:.0f}", fill=PALETTE["cyan"], font=("Consolas", 9))

    def _draw_command_bar(self, canvas: tk.Canvas, value: float, accent: str) -> None:
        canvas.delete("all")
        width = max(canvas.winfo_width(), 10)
        height = max(canvas.winfo_height(), 10)
        center_x = width / 2
        rail_y = height / 2
        pad = 14
        span = (width - pad * 2) / 2

        canvas.create_line(pad, rail_y, width - pad, rail_y, fill=blend(PALETTE["muted"], PALETTE["panel"], 0.45), width=8, capstyle=tk.ROUND)
        canvas.create_line(center_x, rail_y - 10, center_x, rail_y + 10, fill=PALETTE["text"], width=2)

        scale = max(1.0, abs(value))
        length = span * max(-1.0, min(1.0, value / scale))
        x1, x2 = (center_x, center_x + length) if length >= 0 else (center_x + length, center_x)
        fill = accent if abs(value) < 0.75 else blend(accent, PALETTE["warn"], 0.2)
        canvas.create_line(x1, rail_y, x2, rail_y, fill=fill, width=10, capstyle=tk.ROUND)

    def _format_value(self, key: str, raw: object, short: bool = False) -> str:
        kind = FIELD_KINDS.get(key, "string")
        if kind == "bool":
            return self._format_bool_label(key, bool(raw))
        if kind == "string":
            text = str(raw).strip()
            return text or "--"

        number = float(raw)
        if short and key == "Telemetry/Reactive/Front Median (mm)":
            return f"{number:.0f} mm"
        suffix = NUMBER_SUFFIXES.get(key, "")
        decimals = 1 if short or abs(number) >= 100 else 2
        if key == "Telemetry/Reactive/Stable Scan Cycles":
            decimals = 0
        return f"{number:.{decimals}f}{suffix}"

    def _format_bool_label(self, key: str, value: bool) -> str:
        if key == "status":
            return "ONLINE" if value else "OFFLINE"
        polarity = BOOLEAN_POLARITY.get(key, "neutral")
        if value:
            if polarity == "bad":
                return "ALERT"
            if polarity == "warn":
                return "ACTIVE"
            if polarity == "info":
                return "LOCKED"
            return "OK"
        if polarity == "good":
            return "LOST" if key == "Telemetry/NavX/Connected" else "OFF"
        return "CLEAR"

    def _style_for_value(self, key: str, raw: object) -> tuple[str, str]:
        kind = FIELD_KINDS.get(key, "string")
        if kind == "bool":
            return self._bool_style(key, bool(raw))
        if kind == "string":
            return self._string_style(key, str(raw))
        return self._number_style(key, float(raw))

    def _bool_style(self, key: str, value: bool) -> tuple[str, str]:
        polarity = BOOLEAN_POLARITY.get(key, "neutral")
        neutral = blend(PALETTE["panel_alt"], "#000000", 0.16)
        if not value:
            if polarity == "good":
                return blend(PALETTE["panel"], PALETTE["bad"], 0.18), PALETTE["bad"]
            return neutral, PALETTE["muted"]
        if polarity == "good":
            return blend(PALETTE["panel"], PALETTE["good"], 0.18), PALETTE["good"]
        if polarity == "bad":
            return blend(PALETTE["panel"], PALETTE["bad"], 0.18), PALETTE["bad"]
        if polarity == "warn":
            return blend(PALETTE["panel"], PALETTE["warn"], 0.18), PALETTE["warn"]
        if polarity == "info":
            return blend(PALETTE["panel"], PALETTE["cyan"], 0.18), PALETTE["cyan"]
        return neutral, PALETTE["text"]

    def _string_style(self, key: str, value: str) -> tuple[str, str]:
        text = value.upper()
        if key == "Telemetry/Reactive/State":
            if any(token in text for token in ("TURN", "AVOID", "SEARCH")):
                return blend(PALETTE["panel"], PALETTE["warn"], 0.16), PALETTE["warn"]
            if any(token in text for token in ("STOP", "BLOCK", "DEAD")):
                return blend(PALETTE["panel"], PALETTE["bad"], 0.16), PALETTE["bad"]
            if any(token in text for token in ("FORWARD", "TRACK", "FOLLOW", "CENTER")):
                return blend(PALETTE["panel"], PALETTE["good"], 0.16), PALETTE["good"]
            return blend(PALETTE["panel"], PALETTE["magenta"], 0.16), PALETTE["magenta"]
        return blend(PALETTE["panel_alt"], "#000000", 0.18), PALETTE["text"]

    def _number_style(self, key: str, value: float) -> tuple[str, str]:
        neutral = (blend(PALETTE["panel_alt"], "#000000", 0.18), PALETTE["text"])
        if key == "Telemetry/Reactive/Front Median (mm)":
            if value < 350:
                return blend(PALETTE["panel"], PALETTE["bad"], 0.18), PALETTE["bad"]
            if value < 650:
                return blend(PALETTE["panel"], PALETTE["warn"], 0.18), PALETTE["warn"]
            return blend(PALETTE["panel"], PALETTE["good"], 0.18), PALETTE["good"]
        if key in {"Telemetry/Reactive/Angular Error", "Telemetry/Reactive/Lateral Error"}:
            magnitude = abs(value)
            if magnitude > 20:
                return blend(PALETTE["panel"], PALETTE["bad"], 0.18), PALETTE["bad"]
            if magnitude > 8:
                return blend(PALETTE["panel"], PALETTE["warn"], 0.18), PALETTE["warn"]
            return blend(PALETTE["panel"], PALETTE["good"], 0.18), PALETTE["good"]
        if key == "Telemetry/Reactive/Stable Scan Cycles":
            if value < 2:
                return blend(PALETTE["panel"], PALETTE["bad"], 0.18), PALETTE["bad"]
            if value < 5:
                return blend(PALETTE["panel"], PALETTE["warn"], 0.18), PALETTE["warn"]
            return blend(PALETTE["panel"], PALETTE["good"], 0.18), PALETTE["good"]
        if key == "Telemetry/Reactive/Rotation Command":
            if abs(value) > 0.7:
                return blend(PALETTE["panel"], PALETTE["magenta"], 0.18), PALETTE["magenta"]
            return blend(PALETTE["panel"], PALETTE["cyan"], 0.16), PALETTE["cyan"]
        if key in {"Telemetry/Reactive/Pose Heading (deg)", "Telemetry/Reactive/Target Yaw (deg)"}:
            return blend(PALETTE["panel"], PALETTE["magenta"], 0.14), PALETTE["magenta"]
        return neutral

    def _front_detail(self, value: float) -> str:
        if value < 350:
            return "Obstacle dangerously close"
        if value < 650:
            return "Reduced forward margin"
        return "Clear corridor ahead"

    def _scale_distance(self, value: float, minimum: float, maximum: float, low: float, high: float) -> float:
        if maximum <= minimum:
            return low
        ratio = max(0.0, min(1.0, (value - minimum) / (maximum - minimum)))
        return low + (high - low) * ratio

    def _polar_point(self, center_x: float, center_y: float, radius: float, angle_deg: float) -> tuple[float, float]:
        radians = math.radians(angle_deg - 90)
        return (
            center_x + math.cos(radians) * radius,
            center_y + math.sin(radians) * radius,
        )

    def _fit_window(self) -> None:
        try:
            self.state("zoomed")
        except tk.TclError:
            pass

def main() -> None:
    team = load_team_number()
    client = NTClient(team)
    app = ModernTelemetryApp(client)
    app.mainloop()


if __name__ == "__main__":
    main()
