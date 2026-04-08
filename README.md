# ORION Console

ORION Console e o desktop operacional do robo, empacotado com Electron.

Hoje, o fluxo principal do projeto e:
- aplicativo desktop em Electron para a interface
- frontend em React/Vite para a camada visual
- bridge Python/NetworkTables empacotado como binario standalone dentro do desktop

## Estrutura

```text
Orion-Console/
|- frontend/                # React, Vite, Electron e build desktop
|- telemetry_bridge.py      # Fonte do bridge NetworkTables -> HTTP
|- nt_client.py             # Cliente compartilhado de NetworkTables
|- requirements.txt         # Dependencias Python do bridge
`- run_desktop.ps1          # Atalho para rodar e empacotar o desktop
```

## Pre-requisitos

Para desenvolvimento local e builds do desktop no Windows:

- Node.js LTS 24.x
- npm 11.x (vem com o Node LTS)
- Python 3.12, 3.13 ou 3.14 com `pip`

Instalacao sugerida do Node.js via `winget`:

```powershell
winget install OpenJS.NodeJS.LTS
```

## Uso Rapido

Para abrir o desktop em modo de desenvolvimento:

```powershell
.\run_desktop.ps1 -Install
```

Isso sobe:
- Vite em modo de desenvolvimento
- janela do Electron
- bridge local automaticamente

Para gerar o executavel portable do Windows:

```powershell
.\run_desktop.ps1 -Build
```

O executavel final fica em:

```text
frontend/release/ORION Console <versao>.exe
```

## Releases no GitHub

O repositorio agora inclui o workflow `.github/workflows/release-desktop.yml` para gerar o executavel portable no GitHub Actions.

Fluxo recomendado para novas versoes:

1. Atualize a versao em `frontend/package.json`.
2. Faça commit e push na branch normal.
3. Crie uma tag no formato `vX.Y.Z`.
4. Faça push da tag.
5. O GitHub Actions vai gerar o `.exe` em Windows e anexar o arquivo na GitHub Release automaticamente.

Exemplo:

```powershell
git add .
git commit -m "release: prepare v0.1.1"
git push
git tag v0.1.1
git push origin v0.1.1
```

Depois disso, em um PC novo, voce so precisa baixar o `.exe` pronto na pagina de Releases.

## Desenvolvimento Manual

Dentro de `frontend/`:

```powershell
npm install
npm run desktop:dev
```

Builds disponiveis:

```powershell
npm run build:bridge
npm run build:web
npm run build:desktop
```

## Fluxo Tecnico

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

## Telemetria e Comandos

O frontend espera estes endpoints do bridge:
- `GET /health`
- `GET /api/telemetry`
- `GET /api/control-mode`
- `POST /api/control-mode`

Os pontos principais do frontend para isso sao:
- `frontend/src/data/robotBridge.ts`
- `frontend/src/hooks/useTelemetry.ts`
- `frontend/src/hooks/useControlMode.ts`

## Solucao de Problemas

Se o `run_desktop.ps1` falhar logo no comeco:

- confirme se `node --version` retorna `24.x`
- confirme se `npm --version` funciona no terminal
- confirme se `python --version` funciona no terminal

Se o build do bridge falhar:

- confirme se `python -m pip --version` funciona
- evite Python sem `pip` ou instalacoes incompletas
- o script `frontend/scripts/build-bridge.mjs` agora tenta usar uma virtualenv, mas faz fallback para o Python do sistema quando a `venv` falha

Se a janela do Electron nao abrir no modo de desenvolvimento:

- rode `npm run desktop:dev` dentro de `frontend/`
- se houver uma instancia presa em segundo plano, finalize `electron.exe` e tente novamente
- o launcher de desenvolvimento em `frontend/scripts/start-electron.mjs` foi ajustado para iniciar corretamente no Windows

## Observacoes

- O desktop empacotado nao depende de Python instalado na maquina do operador, desde que o build tenha sido gerado com sucesso.
- A fonte de verdade da integracao com o robo continua sendo `telemetry_bridge.py`.
- Se a equipe quiser reduzir ainda mais problemas de setup, o proximo passo ideal e gerar e distribuir os artefatos de release via CI.
