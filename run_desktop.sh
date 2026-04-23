#!/usr/bin/env bash

set -euo pipefail

install_dependencies=false
build_desktop=false

for arg in "$@"; do
  case "$arg" in
    --install)
      install_dependencies=true
      ;;
    --build)
      build_desktop=true
      ;;
    *)
      echo "Argumento invalido: $arg"
      echo "Uso: ./run_desktop.sh [--install] [--build]"
      exit 1
      ;;
  esac
done

workspace_root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
frontend_dir="$workspace_root/frontend"
bridge_executable="$frontend_dir/bridge-dist/orion-telemetry-bridge"

bridge_rebuild_required=false
if [[ ! -f "$bridge_executable" ]]; then
  bridge_rebuild_required=true
else
  for source_path in \
    "$workspace_root/telemetry_bridge.py" \
    "$workspace_root/nt_client.py" \
    "$workspace_root/requirements.txt" \
    "$frontend_dir/scripts/build-bridge.mjs"; do
    if [[ -f "$source_path" && "$source_path" -nt "$bridge_executable" ]]; then
      bridge_rebuild_required=true
      break
    fi
  done
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js nao encontrado nesta maquina."
  echo "Instale o Node.js LTS 24.x e tente novamente."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm nao encontrado nesta maquina."
  exit 1
fi

node_major_version="$(node --version | sed 's/^v//' | cut -d. -f1)"
if [[ "$node_major_version" -lt 24 ]]; then
  echo "Node.js $node_major_version detectado, mas este projeto foi validado com Node.js 24.x ou superior."
  exit 1
fi

cd "$frontend_dir"

if [[ "$install_dependencies" == true || ! -d node_modules || ! -f node_modules/.bin/electron-builder ]]; then
  echo "Instalando dependencias do frontend..."
  npm install --include=dev
fi

if [[ "$build_desktop" == true ]]; then
  echo "Gerando pacote desktop..."
  npm run build:desktop
  echo "Pacote concluido em frontend/release."
  exit 0
fi

if [[ "$bridge_rebuild_required" == true ]]; then
  echo "Compilando telemetry bridge local..."
  npm run build:bridge
fi

echo "Abrindo ORION Console em modo de desenvolvimento..."
npm run desktop:dev
