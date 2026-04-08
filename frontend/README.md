# AMR Reactive Telemetry Dashboard

Dashboard de telemetria para robô móvel construído com React, Vite, TypeScript e Tailwind CSS.

## Rodando localmente

```bash
npm install
npm run dev
```

Para rodar com telemetria real do robô no ambiente atual, use a raiz do projeto:

```powershell
.\run_bridge.ps1
.\run_frontend.ps1
```

Ou em um passo:

```powershell
.\run_live_dashboard.ps1
```

Build de produção:

```bash
npm run build
```

## Modo de telemetria

Por padrão, o frontend tenta consumir o bridge HTTP local em `http://127.0.0.1:8765/api/telemetry`.

Se o bridge não estiver rodando, a UI entra em `offline-standby`:

- fica offline
- não anima dados
- não simula conexão sozinha

Para reativar o modo mock durante desenvolvimento, crie um `.env.local` em `frontend/` com:

```bash
VITE_TELEMETRY_MODE=mock
```

Para forçar modo offline sem bridge:

```bash
VITE_TELEMETRY_MODE=offline
```

## Estrutura principal

```text
src/
  app/
    App.tsx
    layout/
    providers/
  components/
    dashboard/
  data/
    mockTelemetry.ts
    telemetryAdapters.ts
  hooks/
    useTelemetry.ts
    useTheme.ts
  lib/
    alertRules.ts
    cn.ts
    format.ts
  theme/
    ThemeContext.tsx
    themes.ts
    tokens.ts
  types/
    telemetry.ts
```

## Onde trocar mock por backend real

- Fonte principal de dados: `src/hooks/useTelemetry.ts`
- Fonte de bridge e comandos: `src/data/robotBridge.ts`
- Adaptadores de payload: `src/data/telemetryAdapters.ts`
- Tipos de entrada e saída: `src/types/telemetry.ts`
- Regras derivadas de UI e alertas: `src/lib/alertRules.ts`

Fluxo sugerido para integração:

1. O backend Python expõe `/api/telemetry` e `/api/control-mode`.
2. `useTelemetry.ts` consome o snapshot operacional.
3. `useControlMode.ts` consome estado de AUTOMODE e envia comandos.
4. O payload cru é convertido por `adaptBackendTelemetry()` e `adaptControlModePayload()`.
5. O restante da UI continua consumindo tipos estáveis.

## Endpoints esperados

O frontend hoje espera:

- `GET /api/telemetry`
- `GET /api/control-mode`
- `POST /api/control-mode`

Camada frontend correspondente:

- `getTelemetrySnapshot()`
- `subscribeTelemetry()`
- `getControlModes()`
- `requestControlModeChange(modeId)`

Essas funções vivem em `src/data/robotBridge.ts`.

## AUTOMODE real

O bridge Python foi preparado para ler o chooser real do robô em:

```text
SmartDashboard/Auto mode
```

Ele usa as chaves típicas do `SendableChooser`:

- `options`
- `active`
- `default`
- `selected`

O `Control Mode` do frontend não é mais uma lista hardcoded.
Ele consome os modos expostos pelo robô e envia a mudança real via bridge.

## Como adicionar novos painéis

- Criar o componente em `src/components/dashboard/`
- Alimentar o componente com dados tipados em `src/types/telemetry.ts`
- Conectar o novo bloco em `src/app/App.tsx`
- Posicionar o bloco em `src/app/layout/DashboardLayout.tsx`
