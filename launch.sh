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

# Serviço Python (Jarvis) — voz neural para a aba Modo Voz
if command -v python3 >/dev/null 2>&1 && [ -d python-jarvis ]; then
  if python3 -c "import fastapi, uvicorn, edge_tts" 2>/dev/null; then
    (cd python-jarvis && python3 -m uvicorn server:app --host 127.0.0.1 --port 8765 > /tmp/dominic-jarvis.log 2>&1 &)
    JARVIS_PID=$!
    echo "JARVIS_PID=$JARVIS_PID"
    echo "Jarvis local em http://127.0.0.1:8765 (log: /tmp/dominic-jarvis.log)"
  else
    echo "Aviso: dependências do Jarvis não instaladas (pip install -r python-jarvis/requirements.txt)"
  fi
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
