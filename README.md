# Dashboard Telemetry

Dashboard standalone em Python para acompanhar a telemetria essencial da navegacao reativa com LiDAR via NetworkTables.

## Requisitos

- Python 3.9+
- NetworkTables para FRC

## Instalacao

```bash
python -m pip install -r requirements.txt
```

## Execucao

```bash
python dashboard.py
```

Ou, no PowerShell:

```powershell
.\run_dashboard.ps1
```

## Resolucao de conexao

O app tenta se conectar como o ecossistema FRC faz:

- usa `teamNumber` automaticamente
- tenta `startClientTeam(team)` quando a biblioteca suportar
- se nao suportar, faz fallback para:
  - `roborio-1234-frc.local`
  - `10.12.34.2`
  - `10.12.34.11`
  - `vmxpi.local`
  - `localhost`
  - `127.0.0.1`

## Configuracao opcional

- `FRC_TEAM`: sobrescreve o numero do time
- `ROBOT_HOST`: adiciona um host manual com prioridade

## Fontes do team number

O dashboard procura o time nesta ordem:

1. Variavel de ambiente `FRC_TEAM`
2. `.wpilib/wpilib_preferences.json` no diretorio atual
3. `.wpilib/wpilib_preferences.json` ao lado do script
4. `.wpilib/wpilib_preferences.json` no home do usuario
5. fallback para `1234`
