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
|- run_desktop.ps1          # Atalho para rodar e empacotar o desktop no Windows
`- run_desktop.sh           # Atalho para rodar e empacotar o desktop no Linux/macOS
```

## Pré-requisitos

Para desenvolvimento local e builds do desktop:

- Node.js LTS 24.x
- npm 11.x
- Python 3.12, 3.13 ou 3.14 com `pip`

Instalação sugerida do Node.js no Windows via `winget`:

```powershell
winget install OpenJS.NodeJS.LTS
```

## Uso Rápido

### Windows

Para abrir o desktop em modo de desenvolvimento:

```powershell
.\run_desktop.ps1 -Install
```

Para gerar o executável portable do Windows:

```powershell
.\run_desktop.ps1 -Build
```

### Linux

Para abrir o desktop em modo de desenvolvimento:

```bash
./run_desktop.sh --install
```

Para gerar os pacotes Linux:

```bash
./run_desktop.sh --build
```

Os artefatos finais ficam em `frontend/release/`.

## Releases no GitHub

O repositório inclui o workflow `.github/workflows/release-desktop.yml` para gerar artefatos de release automaticamente no GitHub Actions.

Hoje o workflow gera:
- Windows: `.exe` portable
- Linux: `.AppImage` e `.deb`

O build Linux é feito em uma base Ubuntu mais conservadora para reduzir problemas de compatibilidade com `glibc` em máquinas Linux de usuários finais.

Fluxo recomendado para novas versões:

1. Atualize a versão em `frontend/package.json`.
2. Faça commit e push na branch normal.
3. Crie uma tag no formato `vX.Y.Z`.
4. Faça push da tag.
5. O GitHub Actions vai gerar os artefatos e anexá-los na GitHub Release automaticamente.

Exemplo:

```powershell
git add .
git commit -m "release: prepare v0.1.2"
git push
git tag v0.1.2
git push origin v0.1.2
```

Depois disso, em um PC novo, basta baixar o artefato pronto na página de Releases.

## Desenvolvimento Manual

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

## Fluxo Técnico

```text
Robot / SmartDashboard / NetworkTables
                |
                v
      orion-telemetry-bridge(.exe)
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

Os pontos principais do frontend para isso são:
- `frontend/src/data/robotBridge.ts`
- `frontend/src/hooks/useTelemetry.ts`
- `frontend/src/hooks/useControlMode.ts`

## Solução de Problemas

Se o bootstrap falhar logo no começo:

- confirme se `node --version` retorna `24.x`
- confirme se `npm --version` funciona no terminal
- confirme se `python --version` funciona no terminal

Se o build do bridge falhar:

- confirme se `python -m pip --version` funciona
- evite Python sem `pip` ou instalações incompletas
- o script `frontend/scripts/build-bridge.mjs` tenta usar uma virtualenv, mas faz fallback para o Python do sistema quando a `venv` falha

Se a janela do Electron não abrir no modo de desenvolvimento:

- rode `npm run desktop:dev` dentro de `frontend/`
- se houver uma instância presa em segundo plano, finalize o processo do Electron e tente novamente
- o launcher de desenvolvimento em `frontend/scripts/start-electron.mjs` foi ajustado para iniciar corretamente no Windows

## Compatibilidade com Linux

O projeto agora foi preparado para o caminho principal de compatibilidade com Linux:

- o Electron resolve o bridge empacotado por plataforma
- o build do bridge gera o binário com nome adequado para Windows ou Linux
- o `electron-builder` está configurado para gerar `AppImage` e `deb`
- o GitHub Actions gera artefatos Linux junto com os de Windows
- existe um `run_desktop.sh` para bootstrap local em ambientes Unix

Ainda assim, antes de considerar Linux como totalmente homologado, o ideal é validar em uma máquina Linux real:

1. subida do bridge local
2. leitura dos endpoints `/health`, `/api/telemetry` e `/api/control-mode`
3. abertura da janela do Electron
4. execução do `AppImage`
5. instalação do `.deb`

## Observações

- O desktop empacotado não depende de Python instalado na máquina do operador, desde que o build tenha sido gerado com sucesso.
- A fonte de verdade da integração com o robô continua sendo `telemetry_bridge.py`.
- O próximo passo ideal de distribuição é manter os artefatos prontos em Releases, sem versionar binários dentro do Git.
