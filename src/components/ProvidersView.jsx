import { useState } from 'react'
import { KeyRound, Plus, Trash2, PlugZap } from 'lucide-react'

const AVATAR_COLORS = {
  openai: '#ffd43b',
  anthropic: '#ff6b35',
  google: '#2ec4b6',
  groq: '#ff6b6b',
  ollama: '#a29bfe'
}

export default function ProvidersView({ config, onSave, onTest, showToast }) {
  const [editing, setEditing] = useState(null)
  const [draft, setDraft] = useState(null)
  const [addingModel, setAddingModel] = useState('')

  const openEditor = (provider) => {
    setDraft({ ...provider, models: [...provider.models] })
    setEditing(provider.id)
  }

  const closeEditor = () => {
    setEditing(null)
    setDraft(null)
    setAddingModel('')
  }

  const saveEditor = async () => {
    if (!draft) return
    const next = {
      ...config,
      providers: config.providers.map((p) => (p.id === draft.id ? draft : p))
    }
    const ok = await onSave(next)
    if (ok) closeEditor()
  }

  const toggleProvider = async (provider) => {
    const next = {
      ...config,
      providers: config.providers.map((p) =>
        p.id === provider.id ? { ...p, enabled: !p.enabled } : p
      )
    }
    await onSave(next)
  }

  const removeModel = (model) => {
    setDraft((d) => ({ ...d, models: d.models.filter((m) => m !== model) }))
  }

  const addModel = () => {
    const name = addingModel.trim()
    if (!name || draft.models.includes(name)) {
      setAddingModel('')
      return
    }
    setDraft((d) => ({ ...d, models: [...d.models, name] }))
    setAddingModel('')
  }

  const providerColors = (id) => AVATAR_COLORS[id] || '#d9d4ca'

  return (
    <div>
      <p style={{ color: '#555', marginBottom: 20, fontSize: 15 }}>
        Conecte fornecedores de IA e guarde suas chaves API. Tudo é mascarado sob a marca{' '}
        <b>{config.branding.name}</b> — quem usa o chat nunca vê o provedor real.
      </p>

      <div className="provider-list">
        {config.providers.map((p) => (
          <div key={p.id} className="provider-row">
            <div className="provider-avatar" style={{ background: providerColors(p.id) }}>
              {p.name[0]}
            </div>
            <div className="provider-info">
              <h3>
                {p.name}{' '}
                {p.id === 'ollama' && <span className="badge green">Local</span>}
              </h3>
              <p>
                {p.id === 'ollama'
                  ? 'http://localhost:11434'
                  : p.apiKey
                    ? `Chave: ${p.apiKey}`
                    : 'Sem chave configurada'}
              </p>
            </div>

            <div
              className={`toggle ${p.enabled ? 'on' : ''}`}
              title={p.enabled ? 'Clique para desativar' : 'Clique para ativar'}
              onClick={() => toggleProvider(p)}
            />

            <div className="provider-actions">
              <button className="icon-btn" title="Testar conexão" onClick={() => onTest(p.id)}>
                <PlugZap size={18} />
              </button>
              <button className="icon-btn" title="Editar" onClick={() => openEditor(p)}>
                <KeyRound size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {editing && draft && (
        <div className="modal-overlay" onClick={closeEditor}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Configurar: {draft.name}</h3>

            {draft.id !== 'ollama' && (
              <div className="field">
                <label>Chave de API</label>
                <input
                  className="input"
                  type="password"
                  placeholder={draft.apiKey ? '•••• ' + draft.apiKey.slice(-4) : 'Cole sua chave aqui'}
                  value={draft.apiKey && !draft.apiKey.startsWith('••••') ? draft.apiKey : ''}
                  onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })}
                />
                <small style={{ color: '#888', fontSize: 12 }}>
                  Deixe em branco para manter a chave atual.
                </small>
              </div>
            )}

            {draft.id === 'ollama' && (
              <div className="field">
                <label>URL do Ollama</label>
                <input
                  className="input"
                  value={draft.baseUrl}
                  onChange={(e) => setDraft({ ...draft, baseUrl: e.target.value })}
                />
              </div>
            )}

            <div className="field">
              <label>Modelos ({draft.models.length})</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
                {draft.models.map((m) => (
                  <div key={m} className="dataset-row" style={{ marginTop: 0, padding: 8 }}>
                    <div className="ds-info" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }}>
                      {m}
                    </div>
                    <button
                      className="icon-btn"
                      style={{ width: 32, height: 32 }}
                      onClick={() => removeModel(m)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="input"
                  placeholder="Ex: gpt-4o-mini"
                  value={addingModel}
                  onChange={(e) => setAddingModel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addModel()
                    }
                  }}
                />
                <button className="btn ghost" onClick={addModel}>
                  <Plus size={16} /> Adicionar
                </button>
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn ghost" onClick={closeEditor}>Cancelar</button>
              <button className="btn" onClick={saveEditor}>Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
