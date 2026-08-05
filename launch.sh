#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js não encontrado. Instale o Node.js primeiro."
  exit 1
fi
if [ ! -d node_modules ]; then
  npm install --no-fund --no-audit
fi
node server.js > /tmp/dominic-api.log 2>&1 &
API_PID=$!
sleep 2
npm run dev -- --host 0.0.0.0 > /tmp/dominic-vite.log 2>&1 &
VITE_PID=$!
echo "API_PID=$API_PID"
echo "VITE_PID=$VITE_PID"
echo "Abra http://127.0.0.1:5173"
wait "$VITE_PID"
