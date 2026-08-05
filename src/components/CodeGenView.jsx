import { useMemo, useState } from 'react'
import { Code2, Copy, Check, Download, RefreshCw, Loader2, Eye, ExternalLink } from 'lucide-react'
import { generateCode } from '../utils/api.js'

const LANGUAGES = [
  { id: 'html', label: 'HTML + CSS + JS (página única)', ext: 'html', preview: true },
  { id: 'js', label: 'JavaScript', ext: 'js', preview: true },
  { id: 'css', label: 'CSS', ext: 'css', preview: true },
  { id: 'python', label: 'Python', ext: 'py', preview: false },
  { id: 'sql', label: 'SQL (PostgreSQL)', ext: 'sql', preview: false }
]

function stripFences(code) {
  return code
    .trim()
    .replace(/^```[a-zA-Z]*\s*\n?/, '')
    .replace(/\n?```\s*$/, '')
}

const CSS_DEMO_WRAPPER = (css) => `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
${css}
</style>
</head>
<body style="margin:0;font-family:system-ui,sans-serif;padding:24px">
<div class="card" style="border:1px solid #ddd;border-radius:10px;padding:20px;max-width:520px">
  <h1>Pré-visualização do seu CSS</h1>
  <p>Este documento de demonstração usa o CSS gerado. Edite o prompt e gere novamente para ajustar.</p>
  <button class="btn">Botão de exemplo</button>
  <a href="#" class="link">Link de exemplo</a>
  <ul class="list"><li>Item 1</li><li>Item 2</li><li>Item 3</li></ul>
  <input type="text" placeholder="Campo de exemplo">
</div>
</body>
</html>`

export default function CodeGenView({ showToast }) {
  const [lang, setLang] = useState('html')
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [code, setCode] = useState('')
  const [meta, setMeta] = useState(null)
  const [error, setError] = useState(null)
  const [previewKey, setPreviewKey] = useState(0)
  const [copied, setCopied] = useState(false)

  const previewUrl = useMemo(() => {
    if (!code || !meta) return null
    if (meta.lang === 'js') {
      return URL.createObjectURL(new Blob([code], { type: 'text/javascript' }))
    }
    return null
  }, [code, meta])

  const previewDoc = useMemo(() => {
    if (!code || !meta) return null
    if (meta.lang === 'html') return code
    if (meta.lang === 'css') return CSS_DEMO_WRAPPER(code)
    return null
  }, [code, meta])

  const langConfig = LANGUAGES.find((l) => l.id === (meta?.lang || lang)) || LANGUAGES[0]

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      showToast('Descreva o que você quer programar.', 'error')
      return
    }
    setLoading(true)
    setError(null)
    setCode('')
    setMeta(null)
    setPreviewKey((k) => k + 1)
    try {
      const data = await generateCode({ lang, prompt })
      const clean = stripFences(data.code)
      setCode(clean)
      setMeta({ ...data, lang: data.lang || lang })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const handleDownload = () => {
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `dominic-${lang}.${langConfig.ext}`
    a.click()
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-title">👨‍💻 Programar com IA</div>
        <p style={{ color: '#666', fontSize: 14, margin: '6px 0 16px' }}>
          Descreva o que você quer construir e o Dominic gera o código completo.
          Para <b>HTML</b>, <b>JavaScript</b> e <b>CSS</b> você vê um preview ao vivo após criar.
        </p>

        <div className="field">
          <label>Linguagem</label>
          <select className="input" value={lang} onChange={(e) => setLang(e.target.value)}>
            {LANGUAGES.map((l) => (
              <option key={l.id} value={l.id}>{l.label}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>O que você quer programar?</label>
          <textarea
            className="input"
            rows={3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ex: um jogo da velha funcional com placar, estilo moderno com gradientes..."
          />
        </div>

        <button className="btn green" onClick={handleGenerate} disabled={loading}>
          <Code2 size={16} />
          {loading ? 'Gerando código...' : 'Gerar código'}
        </button>

        {error && (
          <div style={{ marginTop: 16, color: '#c00', background: '#fff0f0', padding: 12, borderRadius: 8, fontSize: 14 }}>
            ⚠️ {error}
          </div>
        )}
      </div>

      {(loading || code) && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <div className="card-title" style={{ margin: 0 }}>
              <Code2 size={16} /> Resultado
              {meta && (
                <span style={{ fontSize: 12, color: '#888', fontWeight: 400, marginLeft: 8 }}>
                  via {meta.provider?.name} · {meta.model}
                </span>
              )}
            </div>
            {code && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn ghost" onClick={handleCopy}>
                  {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copiado!' : 'Copiar'}
                </button>
                <button className="btn ghost" onClick={handleDownload}>
                  <Download size={14} /> Baixar .{langConfig.ext}
                </button>
                {langConfig.preview && (
                  <button className="btn ghost" onClick={() => setPreviewKey((k) => k + 1)}>
                    <RefreshCw size={14} /> Recarregar preview
                  </button>
                )}
              </div>
            )}
          </div>

          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#555', fontSize: 14, padding: '20px 0' }}>
              <Loader2 size={18} className="spin" style={{ color: 'var(--green)' }} />
              Escrevendo o código...
            </div>
          )}

          {code && langConfig.preview && (
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 14, marginBottom: 14 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, color: '#666', fontSize: 13 }}>
                  <Code2 size={14} /> Código gerado
                </div>
                <pre
                  style={{
                    margin: 0, background: '#1a1a1a', color: '#e6e6e6', borderRadius: 8,
                    padding: 14, fontSize: 12.5, fontFamily: "'JetBrains Mono', monospace",
                    overflow: 'auto', maxHeight: 520, whiteSpace: 'pre'
                  }}
                >
                  {code}
                </pre>
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, color: '#666', fontSize: 13 }}>
                  <Eye size={14} /> Preview ao vivo
                </div>
                {meta.lang === 'js' && previewUrl ? (
                  <iframe
                    key={previewKey}
                    src={previewUrl}
                    sandbox="allow-scripts"
                    title="Preview JavaScript"
                    style={{ width: '100%', height: 520, border: '1px solid #ddd', borderRadius: 8, background: '#fff' }}
                  />
                ) : previewDoc ? (
                  <iframe
                    key={previewKey}
                    srcDoc={previewDoc}
                    sandbox="allow-scripts"
                    title="Preview HTML/CSS"
                    style={{ width: '100%', height: 520, border: '1px solid #ddd', borderRadius: 8, background: '#fff' }}
                  />
                ) : null}
              </div>
            </div>
          )}

          {code && !langConfig.preview && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, color: '#666', fontSize: 13 }}>
                <Code2 size={14} /> Código gerado ({langConfig.label})
              </div>
              <pre
                style={{
                  margin: 0, background: '#1a1a1a', color: '#e6e6e6', borderRadius: 8,
                  padding: 14, fontSize: 12.5, fontFamily: "'JetBrains Mono', monospace",
                  overflow: 'auto', maxHeight: 520, whiteSpace: 'pre'
                }}
              >
                {code}
              </pre>
              <p style={{ color: '#888', fontSize: 13, marginTop: 8 }}>
                ⚠️ {langConfig.label} não tem preview executável no navegador — copie ou baixe o código e rode na sua máquina.
              </p>
            </div>
          )}
        </div>
      )}

      {code && langConfig.preview && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 style={{ marginBottom: 8 }}>💡 Dica</h3>
          <p style={{ color: '#666', fontSize: 14 }}>
            O preview roda em um <b>iframe isolado</b> (sandbox), então o código gerado não acessa o resto do site.
            O resultado é executado localmente no seu navegador, sem sair da página. Para abrir o preview em uma aba
            maior, baixe o arquivo e abra no navegador.
          </p>
          <a className="btn ghost" style={{ marginTop: 8, textDecoration: 'none' }} onClick={handleDownload}>
            <ExternalLink size={14} /> Baixar e abrir fora do preview
          </a>
        </div>
      )}
    </div>
  )
}
