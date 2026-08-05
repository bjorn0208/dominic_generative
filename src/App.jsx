import { useState, useEffect, useCallback, useRef } from 'react'
import Sidebar from './components/Sidebar.jsx'
import ChatView from './components/ChatView.jsx'
import ProvidersView from './components/ProvidersView.jsx'
import CodeGenView from './components/CodeGenView.jsx'
import AppBuilderView from './components/AppBuilderView.jsx'
import VoicePanel from './components/VoicePanel.jsx'
import Toast from './components/Toast.jsx'
import { fetchConfig, saveConfig, fetchModels, fetchOllamaTags, testConnection } from './utils/api.js'
import './topnav.css'

const BRAND = { name: 'Dominic Generative', tagline: 'Sua própria IA, sob sua marca.' }
const STORAGE_KEY = 'dominic-conversations-v1'

const VIEWS = [
  { id: 'chat', label: '💬 Conversar' },
  { id: 'voice', label: '🎤 Modo Voz' },
  { id: 'providers', label: '🔑 Fornecedores' },
  { id: 'code', label: '👨‍💻 Programar' },
  { id: 'app', label: '🛠️ Criar App' }
]

function newConversation(models) {
  const preferred = models.find((m) => m.providerId === 'groq') || models.find((m) => m.providerId === 'ollama') || models[0]
  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    title: 'Nova conversa',
    providerId: preferred?.providerId || '',
    model: preferred?.model || '',
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
}

function loadConversations() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed
    }
  } catch {
    /* ignore */
  }
  return []
}

export default function App() {
  const [view, setView] = useState('chat')
  const [config, setConfig] = useState(null)
  const [models, setModels] = useState([])
  const [ollamaOnline, setOllamaOnline] = useState(false)
  const [toast, setToast] = useState(null)
  const [backendError, setBackendError] = useState(false)
  const [conversations, setConversations] = useState(loadConversations)
  const [activeConvId, setActiveConvId] = useState(null)
  const [toolRequest, setToolRequest] = useState(null)
  const [pendingVoiceMessage, setPendingVoiceMessage] = useState(null)
  const [smartMode, setSmartMode] = useState(false)
  const [orbFlying, setOrbFlying] = useState(false)
  const toastTimer = useRef(null)
  const bgVideoRef = useRef(null)

  useEffect(() => {
    const v = bgVideoRef.current
    if (!v) return
    v.play().catch(() => {
      const tryPlay = () => v.play().catch(() => {})
      document.addEventListener('click', tryPlay, { once: true })
      document.addEventListener('touchstart', tryPlay, { once: true })
    })
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations))
    } catch {
      /* ignore */
    }
  }, [conversations])

  const showToast = useCallback((message, type = 'ok') => {
    setToast({ message, type })
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 3500)
  }, [])

  const loadAll = useCallback(async () => {
    try {
      const [cfg, modelList] = await Promise.all([fetchConfig(), fetchModels()])
      setConfig(cfg)
      setModels(modelList)
      setBackendError(false)
      fetchOllamaTags()
        .then(() => setOllamaOnline(true))
        .catch(() => setOllamaOnline(false))
    } catch (err) {
      setBackendError(true)
      setToast(`Backend offline: ${err.message}`, 'error')
    }
  }, [])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  useEffect(() => {
    if (models.length && conversations.length && !activeConvId) {
      setActiveConvId(conversations[conversations.length - 1].id)
    }
  }, [models, conversations, activeConvId])

  const activeConversation = conversations.find((c) => c.id === activeConvId) || null

  const handleNewConversation = () => {
    const conv = newConversation(models)
    setConversations((prev) => [...prev, conv])
    setActiveConvId(conv.id)
    setView('chat')
  }

  const handleUpdateConversation = (id, patch) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...patch, updatedAt: new Date().toISOString() } : c))
    )
  }

  const handleDeleteConversation = (id) => {
    setConversations((prev) => {
      const next = prev.filter((c) => c.id !== id)
      if (activeConvId === id) {
        setActiveConvId(next.length ? next[next.length - 1].id : null)
      }
      return next
    })
  }

  const handleSelectConversation = (id) => {
    setActiveConvId(id)
    setView('chat')
  }

  const handleOpenTool = (tool) => {
    setToolRequest(tool)
    setView('chat')
  }

  const handleOpenVoiceChat = (text) => {
    setPendingVoiceMessage(text)
    setView('chat')
  }

  const handleSaveConfig = async (newConfig) => {
    try {
      await saveConfig(newConfig)
      await loadAll()
      showToast('Configurações salvas com sucesso!')
      return true
    } catch (err) {
      showToast(`Falha ao salvar: ${err.message}`, 'error')
      return false
    }
  }

  const handleTestProvider = async (providerId) => {
    try {
      const result = await testConnection(providerId)
      showToast(
        result.ok
          ? `✅ ${result.name} conectado via ${result.model}`
          : `❌ ${result.name}: ${result.message}`,
        result.ok ? 'ok' : 'error'
      )
    } catch (err) {
      showToast(`Erro: ${err.message}`, 'error')
    }
  }

  if (backendError) {
    return (
      <div style={{ height: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
        <div className="card" style={{ maxWidth: 440, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
          <h2 style={{ marginBottom: 8 }}>Backend offline</h2>
          <p style={{ color: '#555', marginBottom: 16, fontSize: 15 }}>
            Não consegui falar com a API do Dominic Generative. Inicie o servidor com:
          </p>
          <pre className="code" style={{ textAlign: 'left', marginBottom: 16 }}>npm run dev</pre>
          <button className="btn" onClick={loadAll}>Tentar novamente</button>
        </div>
      </div>
    )
  }

  if (!config) {
    return (
      <div style={{ height: '100vh', display: 'grid', placeItems: 'center' }}>
        <div className="typing" style={{ transform: 'scale(1.4)' }}>
          <span></span><span></span><span></span>
        </div>
      </div>
    )
  }

  const brand = { ...BRAND, ...config.branding }

  return (
    <div className="app">
      <video ref={bgVideoRef} className="bg-video" autoPlay loop muted playsInline preload="auto">
        <source src="/bg.mp4" type="video/mp4" />
      </video>
      <div className="bg-overlay" />
      <button
        className={`dominic-orb ${smartMode ? 'on' : ''} ${orbFlying ? 'flying' : ''}`}
        onClick={() => {
          setSmartMode((s) => !s)
          setOrbFlying(true)
        }}
        onAnimationEnd={(e) => {
          if (e.animationName === 'cometFlight') setOrbFlying(false)
        }}
        title={smartMode
          ? 'Modo Dominic ATIVO: detecta imagem, vídeo, código ou app pelo prompt'
          : 'Modo Dominic: detecta imagem, vídeo, código ou app pelo prompt'}
      >
        <img src="/favicon.svg" alt="Dominic" />
        <span className="orb-tail" />
      </button>
      <Sidebar
        brand={brand}
        view={view}
        setView={setView}
        ollamaOnline={ollamaOnline}
        providerCount={config.providers.filter((p) => p.enabled).length}
        conversations={conversations}
        activeConvId={activeConvId}
        onNewConversation={handleNewConversation}
        onSelectConversation={handleSelectConversation}
        onDeleteConversation={handleDeleteConversation}
        onOpenTool={handleOpenTool}
      />

      <div className="main">
        <div className="topbar">
          <div className="topbar-title">
            {VIEWS.find((v) => v.id === view)?.label || 'Dominic Generative'}
          </div>

          <div className="brand-chip">
            <span className="dot ok" />
            {brand.name}
          </div>
        </div>

        <div className="content">
          {view === 'chat' && (
            <ChatView
              config={config}
              models={models}
              ollamaOnline={ollamaOnline}
              brand={brand}
              showToast={showToast}
              conversation={activeConversation}
              onNewConversation={handleNewConversation}
              onUpdateConversation={handleUpdateConversation}
              toolRequest={toolRequest}
              onToolHandled={() => setToolRequest(null)}
              smartMode={smartMode}
              voiceInput={pendingVoiceMessage}
              onVoiceInputHandled={() => setPendingVoiceMessage(null)}
            />
          )}
          {view === 'voice' && (
            <VoicePanel showToast={showToast} onOpenChat={handleOpenVoiceChat} />
          )}
          {view === 'providers' && (
            <ProvidersView
              config={config}
              onSave={handleSaveConfig}
              onTest={handleTestProvider}
              showToast={showToast}
            />
          )}
          {view === 'code' && (
            <CodeGenView showToast={showToast} />
          )}
          {view === 'app' && (
            <AppBuilderView showToast={showToast} />
          )}
        </div>

        <div className="status-bar">
          <div className="status-item">
            <span className={`dot ${models.length ? 'ok' : 'warn'}`} />
            <span className="label">Modelos ativos</span>
            {models.length}
          </div>
        </div>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  )
}