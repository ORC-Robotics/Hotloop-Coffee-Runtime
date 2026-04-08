# ORION Console Frontend

Camada React/Vite do desktop ORION Console.

## Desenvolvimento

```bash
npm install
npm run desktop:dev
```

Esse fluxo sobe:
- Vite
- Electron
- bridge local automático

## Builds

```bash
npm run build:bridge
npm run build:web
npm run build:desktop
```

## Estrutura principal

```text
src/
  app/
  components/
  data/
  hooks/
  lib/
  theme/
  types/

electron/
  main.cjs
  preload.cjs

scripts/
  build-bridge.mjs
  start-electron.mjs
```

## Camada de dados

- `src/data/robotBridge.ts`: cliente HTTP do bridge
- `src/hooks/useTelemetry.ts`: polling e estado do dashboard
- `src/hooks/useControlMode.ts`: leitura e comando de AUTOMODE
- `src/data/telemetryAdapters.ts`: adaptação do payload bruto
