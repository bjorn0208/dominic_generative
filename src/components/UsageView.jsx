import { useState, useEffect } from 'react'
import { fetchUsage } from '../utils/api.js'

const PERIODS = [
  { id: '24h', label: '24h' },
  { id: '7d', label: '7 dias' },
  { id: '30d', label: '30 dias' }
]

const PROVIDER_COLORS = {
  openai: '#ffd43b',
  anthropic: '#ff6b35',
  google: '#2ec4b6',
  groq: '#ff6b6b',
  ollama: '#a29bfe'
}

const API_LINKS = [
  {
    name: 'Groq',
    url: 'https://console.groq.com/keys',
    color: '#ff6b6b',
    desc: 'Grátis · Llama, GPT-OSS, Qwen, Mixtral'
  },
  {
    name: 'NVIDIA NIM',
    url: 'https://build.nvidia.com/',
    color: '#76b900',
    desc: 'Grátis · Llama, DeepSeek, Mistral em GPUs NVIDIA'
  },
  {
    name: 'OpenAI',
    url: 'https://platform.openai.com/api-keys',
    color: '#ffd43b',
    desc: 'Pago · GPT, DALL-E, Sora (vídeo)'
  },
  {
    name: 'Anthropic',
    url: 'https://console.anthropic.com/settings/keys',
    color: '#ff6b35',
    desc: 'Pago · Claude'
  },
  {
    name: 'Google Gemini',
    url: 'https://aistudio.google.com/app/apikey',
    color: '#2ec4b6',
    desc: 'Grátis (limite) · Gemini, Veo (vídeo)'
  },
  {
    name: 'Hugging Face',
    url: 'https://huggingface.co/settings/tokens',
    color: '#ffcc00',
    desc: 'Grátis (limite) · FLUX, SD3, Whisper, datasets'
  },
  {
    name: 'Together AI',
    url: 'https://api.together.ai/settings/api-keys',
    color: '#7b5ea7',
    desc: 'Grátis (crédito inicial) · Llama, DeepSeek, Flux'
  },
  {
    name: 'Cloudflare Workers AI',
    url: 'https://dash.cloudflare.com/?to=/:account/workers/ai',
    color: '#f6821f',
    desc: 'Grátis 10k req/dia · Llama, Qwen, DeepSeek'
  },
  {
    name: 'Ollama (local)',
    url: 'https://ollama.com/download',
    color: '#a29bfe',
    desc: 'Grátis · Modelos locais na sua máquina'
  }
]

function formatNumber(n) {
  return Number(n || 0).toLocaleString('pt-BR')
}

export default function UsageView({ showToast }) {
  const [period, setPeriod] = useState('7d')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let alive = true
    setLoading(true)
    fetchUsage(period)
      .then((d) => {
        if (alive) setData(d)
      })
      .catch((err) => {
        if (alive) showToast(`Falha ao carregar uso: ${err.message}`, 'error')
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [period, showToast])

  const summary = data?.summary || {}
  const maxTokens = Math.max(1, ...(data?.hourly || []).map((h) => h.total_tokens))
  const maxBar = (h) => Math.round((h.total_tokens / maxTokens) * 100)

  return (
    <div>
      <p style={{ color: '#555', marginBottom: 20, fontSize: 15 }}>
        Monitoramento de tokens e requisições em tempo real, por provedor e por hora.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {PERIODS.map((p) => (
          <button
            key={p.id}
            className={`btn ${period === p.id ? '' : 'ghost'}`}
            onClick={() => setPeriod(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <div className="typing" style={{ display: 'inline-flex' }}>
            <span></span><span></span><span></span>
          </div>
        </div>
      )}

      {!loading && data && (
        <div style={{ display: 'grid', gap: 24 }}>
          <div className="card">
            <h3 style={{ marginBottom: 16 }}>🔗 Obter chaves de API</h3>
            <p style={{ color: '#666', fontSize: 14, margin: '0 0 12px' }}>
              Clique para abrir o site de cada provedor e gerar sua chave. Cole em{' '}
              <b>Fornecedores & Chaves</b>.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
              {API_LINKS.map((link) => (
                <a
                  key={link.name}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, borderRadius: 10, border: '1px solid #e5e5e5', textDecoration: 'none', color: 'inherit', transition: 'all .15s' }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = link.color; e.currentTarget.style.boxShadow = `0 2px 8px ${link.color}33` }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e5e5e5'; e.currentTarget.style.boxShadow = 'none' }}
                >
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: link.color, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{link.name}</div>
                    <div style={{ color: '#888', fontSize: 12 }}>{link.desc}</div>
                  </div>
                </a>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            <div className="card" style={{ textAlign: 'center', padding: 20 }}>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{formatNumber(summary.requests)}</div>
              <div style={{ color: '#777', fontSize: 13 }}>Requisições</div>
            </div>
            <div className="card" style={{ textAlign: 'center', padding: 20 }}>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{formatNumber(summary.total_tokens)}</div>
              <div style={{ color: '#777', fontSize: 13 }}>Tokens totais</div>
            </div>
            <div className="card" style={{ textAlign: 'center', padding: 20 }}>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{formatNumber(summary.prompt_tokens)}</div>
              <div style={{ color: '#777', fontSize: 13 }}>Tokens de entrada</div>
            </div>
            <div className="card" style={{ textAlign: 'center', padding: 20 }}>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{formatNumber(summary.completion_tokens)}</div>
              <div style={{ color: '#777', fontSize: 13 }}>Tokens de saída</div>
            </div>
          </div>

          <div className="card">
            <h3 style={{ marginBottom: 16 }}>Uso por provedor</h3>
            {data.byProvider.length === 0 && <p style={{ color: '#777' }}>Sem uso no período.</p>}
            {data.byProvider.map((p) => (
              <div key={p.provider_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid #eee' }}>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: PROVIDER_COLORS[p.provider_id] || '#999',
                    flexShrink: 0
                  }}
                />
                <span style={{ flex: 1, fontWeight: 600 }}>{p.provider_id}</span>
                <span style={{ color: '#777', fontSize: 13 }}>{formatNumber(p.requests)} req</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14 }}>
                  {formatNumber(p.total_tokens)} tokens
                </span>
              </div>
            ))}
          </div>

          <div className="card">
            <h3 style={{ marginBottom: 16 }}>Tokens por hora</h3>
            {data.hourly.length === 0 && <p style={{ color: '#777' }}>Sem dados no período.</p>}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 120 }}>
              {data.hourly.map((h) => (
                <div key={h.hour} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 0 }}>
                  <div
                    title={`${formatNumber(h.total_tokens)} tokens · ${h.requests} req`}
                    style={{
                      width: '100%',
                      maxWidth: 40,
                      height: Math.max(4, maxBar(h)),
                      background: '#2ec4b6',
                      borderRadius: '4px 4px 0 0',
                      minHeight: 4
                    }}
                  />
                  <div style={{ fontSize: 10, color: '#999', transform: 'rotate(-45deg)', whiteSpace: 'nowrap' }}>
                    {new Date(h.hour).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h3 style={{ marginBottom: 16 }}>Últimas requisições</h3>
            {data.recent.length === 0 && <p style={{ color: '#777' }}>Nenhuma requisição registrada.</p>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {data.recent.map((r, i) => (
                <div key={i} className="dataset-row" style={{ marginTop: 0, padding: 8 }}>
                  <div className="ds-info">
                    <div style={{ fontWeight: 600, fontSize: 14 }}>
                      {r.provider_id} · {r.model}
                    </div>
                    <div style={{ color: '#888', fontSize: 12 }}>
                      {new Date(r.created_at).toLocaleString('pt-BR')}
                    </div>
                  </div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: '#555' }}>
                    ↑{formatNumber(r.prompt_tokens)} ↓{formatNumber(r.completion_tokens)} · {formatNumber(r.total_tokens)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {!loading && !data && (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <p style={{ color: '#777' }}>Nenhum dado disponível.</p>
        </div>
      )}
    </div>
  )
}