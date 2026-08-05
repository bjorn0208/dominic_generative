import { useEffect, useRef, useState } from 'react'
import { ExternalLink, Copy, Check, Clapperboard, Download, Loader2, XCircle } from 'lucide-react'
import { submitAgnesVideo, getAgnesVideoStatus } from '../utils/api.js'

const VIDEO_OPTIONS = [
  {
    name: 'Wan 2.1 (Alibaba)',
    hf: 'Wan-AI/Wan2.1-T2V-1.3B-Diffusers',
    url: 'https://huggingface.co/Wan-AI/Wan2.1-T2V-1.3B-Diffusers',
    vram: '8 GB VRAM',
    res: '480P',
    desc: 'O modelo de vídeo open-source mais popular. A versão 1.3B roda em GPUs de consumidor (8GB VRAM) e gera vídeos de 480P a partir de texto ou imagem.',
    install: 'pip install diffusers transformers accelerate\nhuggingface-cli download Wan-AI/Wan2.1-T2V-1.3B-Diffusers'
  },
  {
    name: 'LTX-2 (Lightricks)',
    hf: 'diffusers/LTX-2.3-Diffusers',
    url: 'https://huggingface.co/Lightricks/LTX-2',
    vram: '~20 GB VRAM',
    res: 'Até 4K 50FPS',
    desc: 'Modelo aberto que gera vídeo E áudio sincronizados em uma passada. Versão 19B, licença aberta, foco em execução local. Tem demo online no LTX Studio.',
    install: 'pip install diffusers\n# demo online: https://app.ltx.studio/ltx-2-playground/t2v'
  },
  {
    name: 'LTX-Video (Lightricks)',
    hf: 'Lightricks/LTX-Video',
    url: 'https://github.com/Lightricks/LTX-Video',
    vram: '~12 GB VRAM',
    res: '1216x704 30FPS',
    desc: 'Apache 2.0, primeiro modelo DiT de vídeo em tempo real. Suporta texto-para-vídeo, imagem-para-vídeo e extensão de vídeo. 10k+ estrelas no GitHub.',
    install: 'git clone https://github.com/Lightricks/LTX-Video\n# docs: https://huggingface.co/docs/diffusers/api/pipelines/ltx_video'
  },
  {
    name: 'ModelScope Text2Video (estilo Sora)',
    hf: 'ali-vilab/text-to-video-ms-v1',
    url: 'https://huggingface.co/ali-vilab/text-to-video-ms-v1',
    vram: '~16 GB VRAM',
    res: '256x256',
    desc: 'Modelo gratuito de geração de vídeo estilo Sora (256x256, ~2s). Roda com diffusers sem pagar nada. Ideal para testes.',
    install: 'pip install diffusers transformers accelerate'
  }
]

function InstallBlock({ code }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <div style={{ position: 'relative', background: '#1a1a1a', color: '#e6e6e6', borderRadius: 8, padding: '10px 40px 10px 12px', fontSize: 12.5, fontFamily: "'JetBrains Mono', monospace", overflowX: 'auto' }}>
      <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{code}</pre>
      <button
        onClick={copy}
        style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 6, padding: 4, cursor: 'pointer', color: '#fff' }}
        title="Copiar"
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
    </div>
  )
}

export default function VideoGenView({ showToast }) {
  const [selected, setSelected] = useState(null)
  const [prompt, setPrompt] = useState('')
  const [aspect, setAspect] = useState('9:16')
  const [duration, setDuration] = useState(5)
  const [state, setState] = useState('idle') // idle | submitting | polling | done | error
  const [videoId, setVideoId] = useState(null)
  const [videoUrl, setVideoUrl] = useState(null)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState(null)
  const pollRef = useRef(null)

  const clearPoll = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  useEffect(() => clearPoll, [])

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      showToast('Descreva o vídeo que você quer gerar.', 'error')
      return
    }
    setState('submitting')
    setError(null)
    setVideoUrl(null)
    setProgress(0)
    try {
      const data = await submitAgnesVideo({ prompt, duration, aspect })
      setVideoId(data.videoId)
      setState('polling')
      pollRef.current = setInterval(async () => {
        try {
          const st = await getAgnesVideoStatus(data.videoId)
          setProgress(st.progress)
          if (st.status === 'completed' && st.videoUrl) {
            clearPoll()
            setVideoUrl(st.videoUrl)
            setState('done')
          } else if (st.status === 'failed') {
            clearPoll()
            setError(st.error || 'A geração do vídeo falhou.')
            setState('error')
          } else if (st.status === 'error') {
            clearPoll()
            setError('Erro na geração do vídeo.')
            setState('error')
          }
        } catch (err) {
          clearPoll()
          setError(err.message)
          setState('error')
        }
      }, 10_000)
    } catch (err) {
      setError(err.message)
      setState('error')
    }
  }

  const handleCancel = () => {
    clearPoll()
    setState('idle')
    setVideoId(null)
    setError(null)
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-title">🎬 Geração de Vídeo</div>
        <p style={{ color: '#555', fontSize: 15, margin: '8px 0 4px' }}>
          Agora o Dominic gera vídeos <b>diretamente no site, de graça e sem GPU</b>,
          usando a API gratuita da <b>Agnes AI</b> (limite de 20s por clipe, sem
          limite de uso). Também existem modelos <b>open-source</b> que rodam na sua
          máquina (ou GPU na nuvem) — veja abaixo.
        </p>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-title">⚡ Gerar vídeo grátis (Agnes AI)</div>

        <div className="field">
          <label>Prompt</label>
          <textarea
            className="input"
            rows={3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ex: um drone sobrevoando uma floresta de pinheiros ao amanhecer, névoa entre as árvores..."
          />
        </div>

        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 14 }}>
          <div className="field" style={{ flex: 1, minWidth: 180, marginBottom: 0 }}>
            <label>Formato</label>
            <select className="input" value={aspect} onChange={(e) => setAspect(e.target.value)}>
              <option value="9:16">Vertical 9:16 (Shorts/TikTok)</option>
              <option value="16:9">Horizontal 16:9</option>
              <option value="1:1">Quadrado 1:1</option>
            </select>
          </div>
          <div className="field" style={{ flex: 1, minWidth: 180, marginBottom: 0 }}>
            <label>Duração</label>
            <select className="input" value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
              <option value={5}>5 segundos</option>
              <option value={10}>10 segundos</option>
              <option value={15}>15 segundos</option>
              <option value={20}>20 segundos</option>
            </select>
          </div>
        </div>

        {state !== 'polling' && state !== 'submitting' && (
          <button className="btn green" onClick={handleGenerate}>
            <Clapperboard size={16} />
            Gerar vídeo grátis
          </button>
        )}

        {(state === 'submitting' || state === 'polling') && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <Loader2 size={18} className="spin" style={{ color: 'var(--green)' }} />
              <span style={{ color: '#555', fontSize: 14 }}>
                {state === 'submitting'
                  ? 'Enviando para a Agnes AI...'
                  : 'Gerando vídeo na nuvem (pode levar de 30s a alguns minutos)...'}
              </span>
            </div>
            <div style={{ background: '#eee', borderRadius: 8, height: 10, overflow: 'hidden', marginBottom: 12 }}>
              <div
                style={{
                  width: `${Math.max(2, progress)}%`,
                  background: 'var(--green)',
                  height: '100%',
                  transition: 'width 1s ease'
                }}
              />
            </div>
            {progress > 0 && (
              <div style={{ color: '#888', fontSize: 13, marginBottom: 10 }}>
                Progresso: {Math.round(progress)}%
              </div>
            )}
            <button className="btn ghost" onClick={handleCancel}>
              <XCircle size={16} /> Cancelar
            </button>
          </div>
        )}

        {error && (
          <div style={{ marginTop: 16, color: '#c00', background: '#fff0f0', padding: 12, borderRadius: 8, fontSize: 14 }}>
            ⚠️ {error}
          </div>
        )}

        {state === 'done' && videoUrl && (
          <div style={{ marginTop: 18 }}>
            <video src={videoUrl} controls style={{ maxWidth: '100%', maxHeight: 420, borderRadius: 10, border: '1px solid #ddd', background: '#000' }} />
            <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
              <a className="btn ghost" href={videoUrl} download="dominic-video.mp4" style={{ textDecoration: 'none' }}>
                <Download size={16} /> Baixar vídeo
              </a>
              <a className="btn ghost" href={videoUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                <ExternalLink size={16} /> Abrir em nova aba
              </a>
              <span style={{ color: '#888', fontSize: 13 }}>via Agnes AI · agnes-video-v2.0</span>
            </div>
            <button className="btn green" onClick={handleCancel} style={{ marginTop: 14 }}>
              <Clapperboard size={16} /> Gerar outro vídeo
            </button>
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-title">🔓 Modelos open-source (GPU própria ou alugada)</div>
        <p style={{ color: '#666', fontSize: 14, margin: '6px 0 14px' }}>
          Se quiser rodar sem depender de API, escolha um modelo abaixo para ver as instruções.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
          {VIDEO_OPTIONS.map((v) => (
            <div
              key={v.name}
              className="card"
              style={{ cursor: 'pointer', padding: 18, border: selected === v.name ? '3px solid var(--yellow)' : '3px solid var(--ink)' }}
              onClick={() => setSelected(selected === v.name ? null : v.name)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <h3 style={{ fontSize: 16 }}>{v.name}</h3>
                <span className="badge" style={{ background: 'var(--green)', color: '#fff', whiteSpace: 'nowrap' }}>
                  {v.vram}
                </span>
              </div>
              <p style={{ color: '#666', fontSize: 13.5, lineHeight: 1.5 }}>{v.desc}</p>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <a className="btn ghost" style={{ fontSize: 12, padding: '6px 10px', textDecoration: 'none' }} href={v.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                  <ExternalLink size={13} /> Página do modelo
                </a>
                <span style={{ fontSize: 11, color: '#999', alignSelf: 'center' }}>{v.res}</span>
              </div>
              {selected === v.name && (
                <div style={{ marginTop: 14 }}>
                  <InstallBlock code={v.install} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        <h3 style={{ marginBottom: 8 }}>☁️ Rodar na nuvem (GPU alugada) — LTX-Video</h3>
        <p style={{ color: '#666', fontSize: 14, marginBottom: 12 }}>
          O repositório já está no seu projeto em <code>LTX-Video/</code> com o script{' '}
          <code>scripts/ltx-cloud-setup.sh</code>. Alugue uma GPU RTX 4090 por ~US$0.30/h
          no <b>RunPod</b> ou <b>Vast.ai</b>, rode o setup e gere vídeos. Passo a passo:
        </p>
        <ol style={{ paddingLeft: 20, color: '#555', fontSize: 14, lineHeight: 1.9 }}>
          <li>Crie conta em <b>runpod.io</b> ou <b>vast.ai</b></li>
          <li>Pegue um pod com GPU NVIDIA (ex: RTX 4090 / L4 / A100) + template "RunPod PyTorch"</li>
          <li>Acesse o terminal do pod e rode:</li>
        </ol>
        <InstallBlock code={'curl -sL https://raw.githubusercontent.com/Lightricks/LTX-Video/main/ltx-cloud-setup.sh | bash'} />
        <p style={{ color: '#666', fontSize: 14, marginTop: 8 }}>
          Depois do setup, gere um vídeo com:
        </p>
        <InstallBlock code={'cd ~/LTX-Video\npython3 inference.py \\\n  --checkpoint checkpoints/ltxv-2b-0.9.8-distilled.safetensors \\\n  --prompt "Uma tartaruga nadando no fundo do mar" \\\n  --output_dir output --num_frames 121 --width 512 --height 512 \\\n  --use_cpu_offload'} />
        <p style={{ color: '#888', fontSize: 13, marginTop: 10 }}>
          📥 O vídeo sai em <code>output/*.mp4</code>. Baixe com{' '}
          <code>scp -P PORTA root@IP:~/LTX-Video/output/*.mp4 ./</code>
        </p>
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        <h3 style={{ marginBottom: 8 }}>Opções pagas (nuvem, sem GPU local)</h3>
        <p style={{ color: '#666', fontSize: 14, marginBottom: 12 }}>
          Se quiser gerar vídeo direto no site com qualidade superior (sem instalar nada), estes são os serviços disponíveis — todos pagos:
        </p>
        <ul style={{ paddingLeft: 20, color: '#555', fontSize: 14, lineHeight: 1.9 }}>
          <li><b>OpenAI Sora</b> — platform.openai.com (vídeo em até 1080p)</li>
          <li><b>Google Veo 3</b> — aistudio.google.com (gera vídeo + áudio)</li>
          <li><b>Replicate</b> — replicate.com (roda Wan/LTX/FLUX na nuvem por demanda, pago por segundo)</li>
        </ul>
        <p style={{ color: '#888', fontSize: 13, marginTop: 8 }}>
          💡 Se tiver uma chave da OpenAI ou Google com créditos, eu integro a geração de vídeo direto na aba.
        </p>
      </div>
    </div>
  )
}
