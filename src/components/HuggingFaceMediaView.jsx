import { useState } from 'react'
import { ImagePlus, Mic2, Video, Code2, ShoppingCart, Play } from 'lucide-react'
import { fetchHuggingFaceInference } from '../utils/api.js'

const MODES = [
  { id: 'audio', label: 'Áudio', icon: Mic2, hint: 'Reconhecimento de fala / transcrição' },
  { id: 'image', label: 'Imagem', icon: ImagePlus, hint: 'Análise ou legenda de imagem' },
  { id: 'video', label: 'Vídeo', icon: Video, hint: 'Resumo ou legenda de vídeo' },
  { id: 'code', label: 'Código', icon: Code2, hint: 'Geração / explicação de código' }
]

function mimeTypeForMode(mode) {
  if (mode === 'audio') return 'audio/wav'
  if (mode === 'image') return 'image/png'
  if (mode === 'video') return 'video/mp4'
  return ''
}

export default function HuggingFaceMediaView({ config, showToast }) {
  const [mode, setMode] = useState('audio')
  const [file, setFile] = useState(null)
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)

  const hfEnabled = config.huggingface?.enabled

  const handleFileChange = async (event) => {
    const selected = event.target.files?.[0]
    if (!selected) return
    setFile(selected)
    setResult(null)
  }

  const handleSubmit = async () => {
    if (!hfEnabled) {
      showToast('Ative o Hugging Face antes de usar multimodal.', 'error')
      return
    }
    if (!file && mode !== 'code') {
      showToast('Escolha um arquivo para enviar.', 'error')
      return
    }
    if (mode === 'code' && !prompt.trim()) {
      showToast('Digite um prompt de código.', 'error')
      return
    }

    setLoading(true)
    setResult(null)
    try {
      let fileBase64 = null
      let fileMime = null

      if (file) {
        const buffer = await file.arrayBuffer()
        fileBase64 = Buffer.from(buffer).toString('base64')
        fileMime = file.type || mimeTypeForMode(mode)
      }

      const payload = {
        type: mode,
        model: null,
        prompt: mode === 'code' ? prompt : undefined,
        fileBase64,
        fileMime
      }

      const data = await fetchHuggingFaceInference(payload)
      setResult(data)
    } catch (err) {
      setResult({ error: err.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card">
      <div className="card-title">🤗 Hugging Face Multimodal</div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        {MODES.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              className={`btn ghost ${mode === item.id ? 'active' : ''}`}
              onClick={() => {
                setMode(item.id)
                setFile(null)
                setResult(null)
                setPrompt('')
              }}
            >
              <Icon size={16} /> {item.label}
            </button>
          )
        })}
      </div>

      <div className="field">
        <label>Modo</label>
        <p style={{ color: '#666', fontSize: 14, margin: '6px 0' }}>
          {MODES.find((item) => item.id === mode)?.hint}
        </p>
      </div>

      {mode !== 'code' ? (
        <div className="field">
          <label>Arquivo</label>
          <input type="file" accept={mode === 'audio' ? 'audio/*' : mode === 'image' ? 'image/*' : 'video/*'} onChange={handleFileChange} />
          {file && <div style={{ marginTop: 8, fontSize: 14 }}>Selecionado: {file.name}</div>}
        </div>
      ) : (
        <div className="field">
          <label>Prompt de Código</label>
          <textarea
            className="input"
            rows={6}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Explique, gere ou complete o código aqui..."
          />
        </div>
      )}

      <button className="btn green" onClick={handleSubmit} disabled={loading} style={{ marginTop: 12 }}>
        {loading ? 'Processando...' : 'Enviar para Hugging Face'}
      </button>

      {result && (
        <div className="hf-card" style={{ marginTop: 18 }}>
          <div className="card-title">Resultado</div>
          {result.error ? (
            <div style={{ color: '#c00' }}>{result.error}</div>
          ) : (
            <pre className="code" style={{ whiteSpace: 'pre-wrap' }}>{result.result}</pre>
          )}
        </div>
      )}
    </div>
  )
}
