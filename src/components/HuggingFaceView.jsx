import { useState } from 'react'
import { Database, Plus, Trash2, BrainCircuit } from 'lucide-react'
import { fetchHuggingFacePreview } from '../utils/api.js'

export default function HuggingFaceView({ config, onSave, showToast }) {
  const [draftKey, setDraftKey] = useState('')
  const [newDataset, setNewDataset] = useState('')
  const [previewResult, setPreviewResult] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  const hf = config.huggingface

  const saveHF = async (patch) => {
    const next = {
      ...config,
      huggingface: { ...hf, ...patch }
    }
    await onSave(next)
  }

  const handleAddDataset = async () => {
    const ds = newDataset.trim()
    if (!ds) return
    if (hf.datasets.includes(ds)) {
      setNewDataset('')
      showToast('Dataset já adicionado', 'error')
      return
    }
    await saveHF({ datasets: [...hf.datasets, ds] })
    setNewDataset('')
  }

  const handleRemoveDataset = async (ds) => {
    await saveHF({ datasets: hf.datasets.filter((d) => d !== ds) })
    if (previewResult?.dataset === ds) {
      setPreviewResult(null)
    }
  }

  const handlePreviewDataset = async (dataset) => {
    if (!hf.enabled) {
      showToast('Ative o Hugging Face antes de pré-visualizar.', 'error')
      return
    }
    setPreviewLoading(true)
    setPreviewResult(null)
    try {
      const data = await fetchHuggingFacePreview(dataset)
      setPreviewResult({ dataset: data.dataset, preview: data.preview })
    } catch (err) {
      setPreviewResult({ dataset, error: err.message })
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleSaveKey = async () => {
    if (!draftKey.trim()) return
    await saveHF({ apiKey: draftKey.trim() })
    setDraftKey('')
  }

  return (
    <div>
      <h2 style={{ fontSize: 22, marginBottom: 6 }}>🤗 Hugging Face</h2>
      <p style={{ color: '#555', marginBottom: 20, fontSize: 15 }}>
        O suporte a bancos de dados (datasets) reais do Hugging Face está estruturado aqui.
        Conecte sua conta e adicione datasets — a integração completa de RAG (busca no dataset
        dentro das conversas) será ativada numa próxima versão.
      </p>

      <div className="grid-2">
        <div className="card">
          <div className="card-title"><Database size={18} /> Conexão</div>

          <div className="field">
            <label>Token do Hugging Face</label>
            <input
              className="input"
              type="password"
              placeholder={hf.apiKey ? `Chave salva: ${hf.apiKey}` : 'hf_... (cole seu token)'}
              value={draftKey}
              onChange={(e) => setDraftKey(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <div
              className={`toggle ${hf.enabled ? 'on' : ''}`}
              onClick={() => saveHF({ enabled: !hf.enabled })}
            />
            <span style={{ fontSize: 14, fontWeight: 600 }}>
              {hf.enabled ? 'Ativo' : 'Inativo'}
            </span>
          </div>

          <button className="btn" onClick={handleSaveKey} disabled={!draftKey.trim()}>
            Salvar token
          </button>

          <div className="hf-card" style={{ marginTop: 16 }}>
            <div className="card-title" style={{ marginBottom: 8 }}>
              <BrainCircuit size={18} /> Status
            </div>
            <pre className="code" style={{ whiteSpace: 'pre-wrap' }}>
{`{
  "apiKey": ${hf.apiKey ? '✅ configurada' : '❌ ausente'},
  "enabled": ${hf.enabled},
  "datasets": ${hf.datasets.length},
  "rag": "em desenvolvimento"
}`}
            </pre>
          </div>
        </div>

        <div className="card">
          <div className="card-title"><Database size={18} /> Datasets</div>
          <p style={{ color: '#666', fontSize: 13, marginBottom: 12 }}>
            Adicione repos do Hugging Face (ex: <code>datasets/jeopardy</code> ou{' '}
            <code>tatsu-lab/alpaca</code>).
          </p>

          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input
              className="input"
              placeholder="org/nome-do-dataset"
              value={newDataset}
              onChange={(e) => setNewDataset(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleAddDataset()
                }
              }}
            />
            <button className="btn ghost" onClick={handleAddDataset}>
              <Plus size={16} /> Adicionar
            </button>
          </div>

          {hf.datasets.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', border: '2px dashed var(--ink)', borderRadius: 10, color: '#888' }}>
              Nenhum dataset adicionado ainda.
            </div>
          ) : (
            hf.datasets.map((ds) => (
              <div key={ds} className="dataset-row" style={{ alignItems: 'center' }}>
                <div className="ds-info">
                  <b style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }}>{ds}</b>
                  <span>Hugging Face dataset</span>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button className="btn ghost" onClick={() => handlePreviewDataset(ds)} disabled={previewLoading}>
                    {previewLoading && previewResult?.dataset === ds ? 'Carregando...' : 'Preview'}
                  </button>
                  <button className="icon-btn" style={{ width: 34, height: 34 }} onClick={() => handleRemoveDataset(ds)}>
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))
          )}

          {previewResult && (
            <div className="hf-card" style={{ marginTop: 18 }}>
              <div className="card-title" style={{ marginBottom: 8 }}>
                <BrainCircuit size={18} /> Pré-visualização
              </div>
              {previewResult.error ? (
                <div style={{ color: '#c00', fontSize: 14 }}>{previewResult.error}</div>
              ) : (
                <div style={{ fontSize: 13, whiteSpace: 'pre-wrap', color: '#333' }}>
                  <strong>{previewResult.dataset}</strong>
                  <div style={{ marginTop: 10 }}>
                    {previewResult.preview.map((line, index) => (
                      <div key={index} style={{ marginBottom: 8 }}>
                        {line}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
