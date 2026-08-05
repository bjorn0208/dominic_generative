import { useState } from 'react'
import { ImagePlus, Download } from 'lucide-react'
import { generateImage } from '../utils/api.js'

const MODELS = [
  { id: 'stabilityai/stable-diffusion-3-medium-diffusers', label: 'SD3 Medium (Stability) — grátis' },
  { id: 'black-forest-labs/FLUX.1-schnell', label: 'FLUX.1-schnell (pago/não disponível)' }
]

export default function ImageGenView({ config, showToast }) {
  const [model, setModel] = useState(MODELS[0].id)
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [image, setImage] = useState(null)
  const [meta, setMeta] = useState(null)
  const [error, setError] = useState(null)

  const hfEnabled = config.huggingface?.enabled

  const handleGenerate = async () => {
    if (!hfEnabled) {
      showToast('Ative o Hugging Face antes de gerar imagens.', 'error')
      return
    }
    if (!prompt.trim()) {
      showToast('Descreva a imagem que você quer gerar.', 'error')
      return
    }

    setLoading(true)
    setImage(null)
    setError(null)
    setMeta(null)
    try {
      const data = await generateImage({ model, prompt })
      setImage(data.result)
      setMeta(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const downloadImage = () => {
    if (!image) return
    const a = document.createElement('a')
    a.href = `data:${meta?.mimeType || 'image/png'};base64,${image}`
    a.download = `dominica-image-${Date.now()}.png`
    a.click()
  }

  return (
    <div className="card">
      <div className="card-title">🎨 Geração de Imagem</div>
      <p style={{ color: '#666', fontSize: 14, margin: '6px 0 16px' }}>
        Gere imagens a partir de texto usando modelos gratuitos do Hugging Face.
      </p>

      <div className="field">
        <label>Modelo</label>
        <select className="input" value={model} onChange={(e) => setModel(e.target.value)}>
          {MODELS.map((m) => (
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
        </select>
      </div>

      <div className="field">
        <label>Prompt</label>
        <textarea
          className="input"
          rows={3}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ex: um robô gentil sorrindo, em um jardim de flores, estilo anime..."
        />
      </div>

      <button className="btn green" onClick={handleGenerate} disabled={loading}>
        <ImagePlus size={16} />
        {loading ? 'Gerando...' : 'Gerar imagem'}
      </button>

      {error && (
        <div style={{ marginTop: 16, color: '#c00', background: '#fff0f0', padding: 12, borderRadius: 8, fontSize: 14 }}>
          ⚠️ {error}
        </div>
      )}

      {image && (
        <div style={{ marginTop: 18 }}>
          <img
            src={`data:${meta?.mimeType || 'image/png'};base64,${image}`}
            alt="Imagem gerada"
            style={{ maxWidth: '100%', borderRadius: 10, border: '1px solid #ddd' }}
          />
          <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn ghost" onClick={downloadImage}>
              <Download size={16} /> Baixar imagem
            </button>
            <span style={{ color: '#888', fontSize: 13 }}>via {meta?.model}</span>
          </div>
        </div>
      )}
    </div>
  )
}