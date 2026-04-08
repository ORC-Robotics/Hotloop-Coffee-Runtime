# ORION Console

ORION Console é o desktop operacional do robô, empacotado com Electron.

Hoje, o fluxo principal do projeto é:
- aplicativo desktop em Electron para a interface
- frontend em React/Vite para a camada visual
- bridge Python/NetworkTables empacotado como binário standalone dentro do desktop

## Estrutura

```text
Orion-Console/
|- frontend/                # React, Vite, Electron e build desktop
|- telemetry_bridge.py      # Fonte do bridge NetworkTables -> HTTP
|- nt_client.py             # Cliente compartilhado de NetworkTables
|- requirements.txt         # Dependências Python do bridge
`- run_desktop.ps1          # Atalho para rodar e empacotar o desktop
```

## Uso

Para abrir o desktop em modo de desenvolvimento:

```powershell
.\run_desktop.ps1 -Install
```

Isso sobe:
- Vite em modo de desenvolvimento
- janela do Electron
- bridge local automaticamente

Para gerar o executável portable do Windows:

```powershell
.\run_desktop.ps1 -Build
```

O executável final fica em:

```text
frontend/release/ORION Console 0.1.0.exe
```

## Fluxo técnico

```text
Robot / SmartDashboard / NetworkTables
                |
                v
        orion-telemetry-bridge.exe
                |
     +----------+----------+
     |                     |
     v                     v
/api/telemetry      /api/control-mode
     |                     |
     +----------+----------+
                |
                v
       Electron + React dashboard
```

## Desenvolvimento

Dentro de `frontend/`:

```bash
npm install
npm run desktop:dev
```

Builds disponíveis:

```bash
npm run build:bridge
npm run build:web
npm run build:desktop
```

## Telemetria e comandos

O frontend espera estes endpoints do bridge:
- `GET /health`
- `GET /api/telemetry`
- `GET /api/control-mode`
- `POST /api/control-mode`

Os pontos principais do frontend para isso são:
- `frontend/src/data/robotBridge.ts`
- `frontend/src/hooks/useTelemetry.ts`
- `frontend/src/hooks/useControlMode.ts`

## Observações

- O desktop agora não depende mais de Python instalado na máquina do operador.
- O fluxo antigo em Tkinter e os wrappers PowerShell de bridge/frontend foram removidos para reduzir manutenção duplicada.
- A fonte de verdade da integração com o robô continua sendo `telemetry_bridge.py`.
