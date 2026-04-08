# ORION Console

![Status](https://img.shields.io/badge/status-active-6f8f7f?style=flat-square)
![Visibility](https://img.shields.io/badge/repo-private-b8924f?style=flat-square)
![React](https://img.shields.io/badge/react-19-5f91a5?style=flat-square&logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/vite-8-7b79b8?style=flat-square&logo=vite&logoColor=white)
![TypeScript](https://img.shields.io/badge/typescript-6-587c9d?style=flat-square&logo=typescript&logoColor=white)
![Tailwind](https://img.shields.io/badge/tailwind-4-6ea8ad?style=flat-square&logo=tailwindcss&logoColor=white)
![Python](https://img.shields.io/badge/python-bridge-7a8f62?style=flat-square&logo=python&logoColor=white)
![NetworkTables](https://img.shields.io/badge/networktables-live-8c7d68?style=flat-square)

ORION Console é um dashboard operacional para telemetria, supervisão e comando de robôs móveis.

Hoje ele combina:
- frontend React/Vite para visualização operacional
- bridge Python para integração com NetworkTables
- suporte a modos reais do robô via chooser/AUTOMODE
- arquitetura preparada para crescer para vários robôs e layouts futuros

## O que o projeto entrega

- Overview operacional pensada para leitura rápida em campo
- painel de heading/gyro, percepção reativa e intenção local
- alertas, control mode real e estado reativo do robô
- temas `Neutral Pastel` e `Dark Technical`
- integração com telemetria real via bridge local
- fallback offline sem fingir dados quando o robô não está conectado

## Arquitetura

```text
Dashboard/
|- frontend/                 # React + Vite + TypeScript + Tailwind
|- telemetry_bridge.py       # Bridge HTTP para telemetria e control mode
|- nt_client.py              # Cliente NetworkTables compartilhado
|- dashboard.py              # Dashboard standalone em Tkinter (fallback)
|- run_bridge.ps1            # Sobe o bridge
|- run_frontend.ps1          # Sobe o frontend
|- run_live_dashboard.ps1    # Sobe bridge + frontend
`- run_dashboard.ps1         # Sobe a versão Tkinter
```

## Fluxo de dados

```text
Robot / SmartDashboard / NetworkTables
                |
                v
        telemetry_bridge.py
                |
     +----------+----------+
     |                     |
     v                     v
/api/telemetry      /api/control-mode
     |                     |
     +----------+----------+
                |
                v
      React dashboard (ORION Console)
```

## Como rodar

### 1. Dashboard principal com bridge ao vivo

Na raiz do projeto:

```powershell
.\run_live_dashboard.ps1
```

Isso sobe:
- bridge em `http://127.0.0.1:8765`
- frontend em `http://localhost:5173`

### 2. Rodar bridge e frontend separadamente

```powershell
.\run_bridge.ps1
.\run_frontend.ps1
```

### 3. Dashboard Tkinter standalone

Ainda existe como fallback e referência de integração:

```powershell
.\run_dashboard.ps1
```

## Endpoints esperados pelo frontend

O frontend foi organizado para depender de uma camada de bridge clara:

- `GET /api/telemetry`
- `GET /api/control-mode`
- `POST /api/control-mode`
- `GET /health`

No código frontend isso passa por:
- `frontend/src/data/robotBridge.ts`
- `frontend/src/data/telemetryAdapters.ts`
- `frontend/src/hooks/useTelemetry.ts`
- `frontend/src/hooks/useControlMode.ts`

## Control Mode real

O painel de `Control Mode` não usa mais uma lista hardcoded no frontend.

O bridge lê o chooser real do robô em:

```text
SmartDashboard/Auto mode
```

E expõe:
- modos disponíveis
- modo atual
- modo solicitado
- status de sincronização/aplicação

O frontend apenas renderiza e envia comandos.

## Temas

ORION Console suporta dois temas principais:

- `Neutral Pastel`
- `Dark Technical`

Os tokens visuais ficam centralizados em:
- `frontend/src/theme/tokens.ts`
- `frontend/src/theme/themes.ts`
- `frontend/src/theme/ThemeContext.tsx`

## Desenvolvimento frontend

Dentro de `frontend/`:

```bash
npm install
npm run dev
```

Build de produção:

```bash
npm run build
```

Modo mock opcional:

```bash
VITE_TELEMETRY_MODE=mock
```

Modo offline forçado:

```bash
VITE_TELEMETRY_MODE=offline
```

## Stack

- React
- Vite
- TypeScript
- Tailwind CSS
- Python
- NetworkTables / SmartDashboard

## Estrutura frontend

```text
frontend/src/
|- app/
|  |- App.tsx
|  |- layout/
|  `- providers/
|- components/dashboard/
|- data/
|- hooks/
|- lib/
|- theme/
`- types/
```

## Próximos passos naturais

- perfis e layouts por robô
- backend/bridge multi-robô
- persistência de configurações operacionais
- empacotamento desktop com Electron
- camadas mais formais de observabilidade do bridge

## Repositório

- Organization: `ORC-Robotics`
- Repository: `Orion-Console`

Se você estiver trabalhando na integração com o robô, o ponto principal de contrato é o `telemetry_bridge.py`.
