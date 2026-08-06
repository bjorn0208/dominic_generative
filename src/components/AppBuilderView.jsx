import { useState, useRef, useEffect } from 'react'
import { Sparkles, RefreshCw, Download, ExternalLink, Loader2, Copy, Check, Wrench, Send, Plus, Bot } from 'lucide-react'
import { generateApp, modifyApp, suggestAppImprovements, generateAppName } from '../utils/api.js'

export default function AppBuilderView({ showToast }) {
  const [prompt, setPrompt] = useState('')
  const [code, setCode] = useState('')
  const [appName, setAppName] = useState('')
  const [summary, setSummary] = useState([])
  const [suggestions, setSuggestions] = useState([])
  const [modifyInput, setModifyInput] = useState('')
  const [chat, setChat] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingModify, setLoadingModify] = useState(false)
  const [error, setError] = useState(null)
  const [previewKey, setPreviewKey] = useState(0)
  const [copied, setCopied] = useState(false)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chat, loadingModify])

  const pushChat = (msg) => setChat((prev) => [...prev, msg])

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
    pushChat({ role: 'user', content: prompt.trim() })
    setPrompt('')
    try {
      const data = await generateApp({ prompt })
      setCode(data.code)
      pushChat({ role: 'assistant', kind: 'created', content: 'App criado! Peça qualquer mudança pelo chat que eu edito na hora — o preview atualiza ao lado.' })
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
      setError(err.message)
      pushChat({ role: 'assistant', kind: 'error', content: `⚠️ ${err.message}` })
    } finally {
      setLoading(false)
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
    pushChat({ role: 'user', content: text.trim() })
    setModifyInput('')
    try {
      const data = await modifyApp({ code, prompt: text })
      setCode(data.code)
      const items = Array.isArray(data.summary) ? data.summary : String(data.summary).split('\n').filter(Boolean)
      setSummary(items)
      setPreviewKey((k) => k + 1)
      setSuggestions([])
      pushChat({ role: 'assistant', kind: 'modified', content: items.length ? `Feito! ${items.map((s) => s.replace(/^[-•]\s*/, '')).join(' · ')}` : 'Feito! Alterações aplicadas no preview.' })
    } catch (err) {
      setError(err.message)
      pushChat({ role: 'assistant', kind: 'error', content: `⚠️ ${err.message}` })
    } finally {
      setLoadingModify(false)
    }
  }

  const handleNew = () => {
    setCode('')
    setChat([])
    setAppName('')
    setSummary([])
    setSuggestions([])
    setError(null)
    setPrompt('')
    setModifyInput('')
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

  const handleOpenOutside = () => {
    const blob = new Blob([code], { type: 'text/html;charset=utf-8' })
    window.open(URL.createObjectURL(blob), '_blank')
  }

  const handleInputKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleModify()
    }
  }

  const handlePromptKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleCreate()
    }
  }

  return (
    <div>
      {!code && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-title">🛠️ Criar App (estilo Lovable)</div>
          <p style={{ color: '#666', fontSize: 14, margin: '6px 0 16px' }}>
            Descreva um app em linguagem natural e o Dominic gera um app completo em{' '}
            <b>HTML + React + Tailwind</b> com preview ao vivo. Depois é só pedir mudanças
            no chat — exatamente como o Lovable.
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
              onKeyDown={handlePromptKey}
              placeholder="Ex: um dashboard financeiro com gráficos, lista de transações e saldo atual, tema escuro premium..."
            />
          </div>

          <button className="btn green" onClick={handleCreate} disabled={loading}>
            <Sparkles size={16} />
            {loading ? 'Criando app...' : '✨ Criar app'}
          </button>

          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#555', fontSize: 14, padding: '18px 0 4px' }}>
              <Loader2 size={18} className="spin" style={{ color: 'var(--green)' }} />
              Gerando o app (pode levar de 30s a 2 min)...
            </div>
          )}

          {error && (
            <div style={{ marginTop: 16, color: '#c00', background: '#fff0f0', padding: 12, borderRadius: 8, fontSize: 14 }}>
              ⚠️ {error}
            </div>
          )}
        </div>
      )}

      {code && (
        <div className="appbuilder-editor">
          <div className="appbuilder-chat">
            <div className="appbuilder-chat-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <Bot size={17} style={{ color: 'var(--green)', flexShrink: 0 }} />
                <h3 style={{ margin: 0, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {appName || 'Meu App'}
                </h3>
              </div>
              <button className="btn ghost" onClick={handleNew} style={{ fontSize: 12.5, padding: '6px 10px' }}>
                <Plus size={13} /> Novo app
              </button>
            </div>

            <div className="appbuilder-messages">
              {chat.map((m, i) => (
                <div key={i} className={`appbuilder-msg ${m.role} ${m.kind === 'error' ? 'error' : ''}`}>
                  {m.role === 'assistant' && m.kind !== 'error' && (
                    <div style={{ fontSize: 11.5, color: 'var(--green)', fontWeight: 700, marginBottom: 3 }}>
                      ✓ {m.kind === 'created' ? 'App criado' : 'Mudanças aplicadas'}
                    </div>
                  )}
                  {m.content}
                </div>
              ))}
              {loadingModify && (
                <div className="appbuilder-msg assistant" style={{ color: '#888' }}>
                  <Loader2 size={14} className="spin" style={{ marginRight: 6, verticalAlign: '-2px' }} />
                  Aplicando mudanças...
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {suggestions.length > 0 && (
              <div className="appbuilder-suggestions">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    className="btn ghost"
                    style={{ fontSize: 12, padding: '6px 10px' }}
                    onClick={() => handleModify(s)}
                    disabled={loadingModify}
                  >
                    <Sparkles size={12} /> {s}
                  </button>
                ))}
              </div>
            )}

            <div className="appbuilder-input">
              <textarea
                ref={inputRef}
                value={modifyInput}
                onChange={(e) => setModifyInput(e.target.value)}
                onKeyDown={handleInputKey}
                placeholder="Peça uma mudança... (Enter envia)"
                rows={1}
              />
              <button className="btn green" onClick={() => handleModify()} disabled={loadingModify} title="Enviar">
                {loadingModify ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
              </button>
            </div>
          </div>

          <div className="appbuilder-preview">
            <div className="appbuilder-preview-toolbar">
              <button className="btn ghost" onClick={handleCopy} style={{ fontSize: 12, padding: '6px 10px' }}>
                {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copiado!' : 'Copiar'}
              </button>
              <button className="btn ghost" onClick={handleDownload} style={{ fontSize: 12, padding: '6px 10px' }}>
                <Download size={13} /> Baixar .html
              </button>
              <button className="btn ghost" onClick={handleOpenOutside} style={{ fontSize: 12, padding: '6px 10px' }}>
                <ExternalLink size={13} /> Abrir fora
              </button>
              <button className="btn ghost" onClick={() => setPreviewKey((k) => k + 1)} style={{ fontSize: 12, padding: '6px 10px' }}>
                <RefreshCw size={13} /> Recarregar
              </button>
            </div>
            <iframe
              key={previewKey}
              srcDoc={code}
              sandbox="allow-scripts"
              title="Preview do app"
              className="appbuilder-iframe"
            />
          </div>
        </div>
      )}

      {code && summary.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-title">📋 Últimas mudanças</div>
          <ul style={{ margin: 0, paddingLeft: 18, color: '#555', fontSize: 13.5, lineHeight: 1.7 }}>
            {summary.map((s, i) => (
              <li key={i}>{s.replace(/^[-•]\s*/, '')}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
