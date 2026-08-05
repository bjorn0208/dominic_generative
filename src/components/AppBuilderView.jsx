import { useState } from 'react'
import { Sparkles, RefreshCw, Download, ExternalLink, Loader2, Copy, Check, Wrench } from 'lucide-react'
import { generateApp, modifyApp, suggestAppImprovements, generateAppName } from '../utils/api.js'

export default function AppBuilderView({ showToast }) {
  const [prompt, setPrompt] = useState('')
  const [code, setCode] = useState('')
  const [appName, setAppName] = useState('')
  const [summary, setSummary] = useState([])
  const [suggestions, setSuggestions] = useState([])
  const [modifyInput, setModifyInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingModify, setLoadingModify] = useState(false)
  const [error, setError] = useState(null)
  const [previewKey, setPreviewKey] = useState(0)
  const [copied, setCopied] = useState(false)

  const handleCreate = async () => {
    if (!prompt.trim()) {
      showToast('Descreva o app que você quer criar.', 'error')
      return
    }
    setLoading(true)
    setError(null)
    setCode('')
    setAppName('')
    setSummary([])
    setSuggestions([])
    setPreviewKey((k) => k + 1)
    try {
      const data = await generateApp({ prompt })
      setCode(data.code)
      setLoading(false)
      try {
        const [nameRes, suggestRes] = await Promise.all([
          generateAppName({ prompt }),
          suggestAppImprovements({ prompt })
        ])
        setAppName(nameRes.name)
        setSuggestions(suggestRes.suggestions || [])
      } catch {
        /* nome/sugestões são opcionais */
      }
    } catch (err) {
      setLoading(false)
      setError(err.message)
    }
  }

  const handleModify = async (suggestion) => {
    const text = suggestion || modifyInput
    if (!text.trim()) {
      showToast('Descreva o que você quer mudar.', 'error')
      return
    }
    if (!code) {
      showToast('Gere um app antes de modificar.', 'error')
      return
    }
    setLoadingModify(true)
    setError(null)
    try {
      const data = await modifyApp({ code, prompt: text })
      setCode(data.code)
      setSummary(Array.isArray(data.summary) ? data.summary : String(data.summary).split('\n').filter(Boolean))
      setPreviewKey((k) => k + 1)
      setModifyInput('')
      setSuggestions([])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingModify(false)
    }
  }

  const handleDownload = () => {
    const blob = new Blob([code], { type: 'text/html;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${(appName || 'dominic-app').toLowerCase().replace(/\s+/g, '-')}.html`
    a.click()
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-title">🛠️ Criar App (estilo Lovable)</div>
        <p style={{ color: '#666', fontSize: 14, margin: '6px 0 16px' }}>
          Descreva um app em linguagem natural e o Dominic gera um app completo em{' '}
          <b>HTML + React + Tailwind</b> com preview ao vivo. Depois é só pedir mudanças
          e ele reconstrói na hora — exatamente como o Lovable.
        </p>
        <p style={{ color: '#888', fontSize: 13, margin: '4px 0 14px' }}>
          ⚠️ Use a IA <b>Google Gemini</b>. Se ainda não configurou a chave, adicione na
          aba <b>🔑 Fornecedores</b> (provider Google).
        </p>

        <div className="field">
          <label>Descreva seu app</label>
          <textarea
            className="input"
            rows={3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ex: um dashboard financeiro com gráficos, lista de transações e saldo atual, tema escuro premium..."
          />
        </div>

        <button className="btn green" onClick={handleCreate} disabled={loading}>
          <Sparkles size={16} />
          {loading ? 'Criando app...' : '✨ Criar app'}
        </button>

        {error && (
          <div style={{ marginTop: 16, color: '#c00', background: '#fff0f0', padding: 12, borderRadius: 8, fontSize: 14 }}>
            ⚠️ {error}
          </div>
        )}
      </div>

      {loading && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#555', fontSize: 14, padding: '20px 0' }}>
            <Loader2 size={18} className="spin" style={{ color: 'var(--green)' }} />
            Gerando o app (pode levar de 30s a 2 min)...
          </div>
        </div>
      )}

      {code && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h3 style={{ margin: 0 }}>{appName || 'Meu App'}</h3>
              <span className="badge" style={{ background: 'var(--yellow)', color: '#000' }}>prévia</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn ghost" onClick={handleCopy}>
                {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copiado!' : 'Copiar código'}
              </button>
              <button className="btn ghost" onClick={handleDownload}>
                <Download size={14} /> Baixar .html
              </button>
              <button className="btn ghost" onClick={() => setPreviewKey((k) => k + 1)}>
                <RefreshCw size={14} /> Recarregar preview
              </button>
              <a className="btn ghost" onClick={handleDownload}>
                <ExternalLink size={14} /> Abrir fora
              </a>
            </div>
          </div>

          <iframe
            key={previewKey}
            srcDoc={code}
            sandbox="allow-scripts"
            title="Preview do app"
            style={{ width: '100%', height: 520, border: '1px solid #ddd', borderRadius: 10, background: '#fff' }}
          />
        </div>
      )}

      {code && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-title">✏️ Modificar app</div>
          <div className="field">
            <label>O que você quer mudar?</label>
            <textarea
              className="input"
              rows={2}
              value={modifyInput}
              onChange={(e) => setModifyInput(e.target.value)}
              placeholder="Ex: adicione um botão de exportar CSV e deixe o design mais moderno..."
            />
          </div>
          <button className="btn" onClick={handleModify} disabled={loadingModify}>
            {loadingModify ? <Loader2 size={16} className="spin" /> : <Wrench size={16} />}
            {loadingModify ? 'Aplicando...' : 'Aplicar mudanças'}
          </button>

          {summary.length > 0 && (
            <div style={{ marginTop: 14, background: '#f6f6ff', border: '1px solid #e0e0ff', borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: 13, color: '#666', marginBottom: 6, fontWeight: 600 }}>✅ Resumo das mudanças</div>
              <ul style={{ margin: 0, paddingLeft: 18, color: '#555', fontSize: 13.5, lineHeight: 1.7 }}>
                {summary.map((s, i) => (
                  <li key={i}>{s.replace(/^[-•]\s*/, '')}</li>
                ))}
              </ul>
            </div>
          )}

          {suggestions.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 13, color: '#666', marginBottom: 8, fontWeight: 600 }}>💡 Sugestões para melhorar</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    className="btn ghost"
                    style={{ fontSize: 12.5, padding: '7px 12px' }}
                    onClick={() => handleModify(s)}
                    disabled={loadingModify}
                  >
                    <Sparkles size={13} /> {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}