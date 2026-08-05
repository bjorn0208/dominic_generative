#!/usr/bin/env bash
# Setup do LTX-Video em GPU na nuvem (RunPod / Vast.ai / Lambda)
# Rodar como root no servidor: bash ltx-cloud-setup.sh
set -e

echo "==> [1/5] Verificando GPU..."
nvidia-smi --query-gpu=name,memory.total --format=csv,noheader
echo ""

echo "==> [2/5] Instalando dependências do sistema..."
apt-get update -qq
apt-get install -y -qq ffmpeg git python3-pip curl > /dev/null 2>&1

echo "==> [3/5] Instalando PyTorch com CUDA..."
pip3 install torch torchvision --index-url https://download.pytorch.org/whl/cu121 -q

echo "==> [4/5] Clonando e instalando LTX-Video..."
if [ ! -d LTX-Video ]; then
  git clone --depth 1 https://github.com/Lightricks/LTX-Video.git
fi
cd LTX-Video
pip3 install -e ".[inference]" -q

echo "==> [5/5] Baixando modelo 2B distilled (~7GB)..."
python3 - <<'PY'
from huggingface_hub import hf_hub_download
import os
os.makedirs("checkpoints", exist_ok=True)
for f in ["ltxv-2b-0.9.8-distilled.safetensors", "ltxv-spatial-upscaler-0.9.8.safetensors"]:
    path = hf_hub_download(repo_id="Lightricks/LTX-Video", filename=f, local_dir="checkpoints")
    print("Baixado:", path)
PY

echo ""
echo "======================================================"
echo "✅ SETUP COMPLETO!"
echo "Gerar vídeo:"
echo "  cd ~/LTX-Video"
echo '  python3 inference.py --checkpoint checkpoints/ltxv-2b-0.9.8-distilled.safetensors --prompt "Uma tartaruga nadando no fundo do mar" --output_dir output --num_frames 121 --width 512 --height 512 --use_cpu_offload'
echo ""
echo "O vídeo MP4 será salvo em output/"
echo "Baixe via: scp -P PORTA root@SEU_SERVIDOR:~/LTX-Video/output/*.mp4 ./"
echo "======================================================"