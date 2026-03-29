#!/usr/bin/env bash
# Libère un port TCP (ex. 3000 pour Next, 8000 pour uvicorn). Usage : bash scripts/free-port.sh 3000
set -euo pipefail
PORT="${1:?Usage: free-port.sh <port>}"
PIDS=$(lsof -ti ":$PORT" 2>/dev/null || true)
if [[ -n "$PIDS" ]]; then
  echo "[postuly] Arrêt des processus sur le port $PORT : $PIDS"
  kill -9 $PIDS 2>/dev/null || true
else
  echo "[postuly] Port $PORT déjà libre."
fi
