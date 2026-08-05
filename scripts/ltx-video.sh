#!/usr/bin/env bash
# LTX-Video — Gerador de vídeo local (requer GPU NVIDIA com CUDA)
# Uso: ./scripts/ltx-video.sh install | run "<prompt>" | requirements
set -e
cd "$(dirname "$0")/.."
LTX_DIR="LTX-Video"
CMD="${1:-requirements}"

requirements() {
  echo "==> Verificando requisitos do LTX-Video..."
  if ! command -v nvidia-smi >/dev/null 2>&1; then
    echo "❌ GPU NVIDIA não encontrada (nvidia-smi ausente)."
    echo "   O LTX-Video é um modelo de difusão que exige GPU NVIDIA com CUDA (min. 8-12GB VRAM)."
    echo "   Opções:"
    echo "   - Instalar driver NVIDIA + CUDA nesta máquina"
    echo "   - Usar uma GPU na nuvem (Vast.ai, RunPod, Lambda) e rodar este script lá"
    echo "   - Usar o LTX Studio online: https://app.ltx.studio/ltx-2-playground/t2v"
    return 1
  fi
  nvidia-smi --query-gpu=name,memory.total --format=csv,noheader
  python3 -c "import torch" 2>/dev/null || echo "⚠️ PyTorch não instalado (rode: ./scripts/ltx-video.sh install)"
  python3 -c "import torch; print('✅ PyTorch', torch.__version__, '| CUDA disponível:', torch.cuda.is_available())" 2>/dev/null || true
}

install() {
  echo "==> Instalando dependências do LTX-Video..."
  cd "$LTX_DIR"
  python3 -m pip install --upgrade pip
  python3 -m pip install -e ".[inference]"
  echo "✅ Instalado. Agora baixe o modelo 2B (leve, ~12GB VRAM):"
  echo "   huggingface-cli download Lightricks/LTX-Video --include 'ltxv-2b-0.9.8-distilled.safetensors' --local-dir ./checkpoints"
}

run() {
  PROMPT="${1:-Uma tartaruga nadando no fundo do mar, câmera lenta}"
  echo "==> Gerando vídeo com LTX-Video (2B distilled)..."
  echo "    Prompt: $PROMPT"
  cd "$LTX_DIR"
  python3 inference.py \
    --checkpoint ltxv-2b-0.9.8-distilled.safetensors \
    --prompt "$PROMPT" \
    --output_dir ../data/videos \
    --num_frames 121 \
    --width 512 \
    --height 512 \
    --batch_size 1 \
    --use_cpu_offload
  echo "✅ Vídeo salvo em data/videos/"
}

case "$CMD" in
  requirements) requirements ;;
  install) install ;;
  run) run "$2" ;;
  *) echo "Uso: ./scripts/ltx-video.sh [requirements|install|run \"<prompt>\"]" ;;
esac
