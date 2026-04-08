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
      echo "Argumento inválido: $arg"
      echo "Uso: ./run_desktop.sh [--install] [--build]"
      exit 1
      ;;
  esac
done

workspace_root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
frontend_dir="$workspace_root/frontend"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js não encontrado nesta máquina."
  echo "Instale o Node.js LTS 24.x e tente novamente."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm não encontrado nesta máquina."
  exit 1
fi

node_major_version="$(node --version | sed 's/^v//' | cut -d. -f1)"
if [[ "$node_major_version" -lt 24 ]]; then
  echo "Node.js $node_major_version detectado, mas este projeto foi validado com Node.js 24.x ou superior."
  exit 1
fi

cd "$frontend_dir"

if [[ "$install_dependencies" == true || ! -d node_modules || ! -f node_modules/.bin/electron-builder ]]; then
  echo "Instalando dependências do frontend..."
  npm install --include=dev
fi

if [[ "$build_desktop" == true ]]; then
  echo "Gerando pacote desktop..."
  npm run build:desktop
  echo "Pacote concluído em frontend/release."
  exit 0
fi

echo "Abrindo ORION Console em modo de desenvolvimento..."
npm run desktop:dev
