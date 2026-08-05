import { useState, useRef, useEffect } from 'react'
import { Send, Plus, Image, Video, Code2, Wrench, X, ChevronDown, Menu } from 'lucide-react'
import { sendChat } from '../utils/api.js'
import { generateImage } from '../utils/api.js'
import { submitAgnesVideo, getAgnesVideoStatus } from '../utils/api.js'
import { generateCode } from '../utils/api.js'
import { generateApp, modifyApp, suggestAppImprovements, generateAppName } from '../utils/api.js'

export default function ChatView({ models, ollamaOnline, brand, showToast, conversation, onNewConversation, onUpdateConversation }) {
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [showTools, setShowTools] = useState(false)
  const [activeTool, setActiveTool] = useState(null)
  const [toolState, setToolState] = useState({})
  const bottomRef = useRef(null)

  const messages = conversation?.messages || []
  const providerId = conversation?.providerId || ''
  const model = conversation?.model || ''

  useEffect(() => {
    if (!conversation && models.length) {
      onNewConversation()
    }
  }, [conversation, models.length, onNewConversation])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, busy])

  const availableModels = models.filter((m) => m.providerId === providerId)

  const handleProviderChange = (id) => {
    const first = models.find((m) => m.providerId === id)
    onUpdateConversation(conversation.id, {
      providerId: id,
      model: first?.model || ''
    })
  }

  const handleModelChange = (m) => {
    onUpdateConversation(conversation.id, { model: m })
  }

  const addMessage = (content, role = 'assistant', meta = null) => {
    onUpdateConversation(conversation.id, {
      messages: [...messages, { role, content, meta }]
    })
  }

  const handleSend = async () => {
    const text = input.trim()
    if (!text || busy || !model || !conversation) return

    const userMsg = { role: 'user', content: text }
    const next = [...messages, userMsg]
    onUpdateConversation(conversation.id, {
      messages: next,
      title: conversation.title === 'Nova conversa' ? text.slice(0, 60) : conversation.title
    })
    setInput('')
    setBusy(true)
    try {
      const payload = [
        {
          role: 'system',
          content: `Você é ${brand.name}, uma IA generativa proprietária criada pelo usuário. Responda de forma útil, direta e amigável, em português. Nunca mencione que você usa modelos de terceiros, provedores de API, empresas como OpenAI, Anthropic, Google ou Meta, nem nomes de modelos.`
        },
        ...next.map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }))
      ]
      const data = await sendChat({ providerId, model, messages: payload })
      addMessage(data.reply, 'assistant', `via ${data.provider?.name} · ${data.model}`)
    } catch (err) {
      addMessage(`⚠️ ${err.message}`, 'assistant', null, true)
    } finally {
      setBusy(false)
    }
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Tool handlers
  const handleImageGenerate = async (prompt) => {
    setToolState(s => ({ ...s, imageLoading: true, imageError: null }))
    try {
      const data = await generateImage({ model: 'stabilityai/stable-diffusion-3-medium-diffusers', prompt })
      const result = `![imagem gerada](data:${data.mimeType || 'image/png'};base64,${data.result})`
      addMessage(result, 'assistant', `imagem via ${data.model}`)
    } catch (err) {
      setToolState(s => ({ ...s, imageError: err.message }))
    } finally {
      setToolState(s => ({ ...s, imageLoading: false }))
    }
  }

  const handleVideoGenerate = async (prompt) => {
    setToolState(s => ({ ...s, videoLoading: true, videoError: null, videoId: null }))
    try {
      const data = await submitAgnesVideo({ prompt, duration: 5, aspect: '16:9' })
      setToolState(s => ({ ...s, videoId: data.videoId, videoLoading: false, videoPolling: true }))
      // Poll for completion
      const poll = setInterval(async () => {
        try {
          const st = await getAgnesVideoStatus(data.videoId)
          if (st.status === 'completed' && st.videoUrl) {
            clearInterval(poll)
            const result = `🎬 [Vídeo gerado](${st.videoUrl})`
            addMessage(result, 'assistant', 'vídeo via Agnes AI')
            setToolState(s => ({ ...s, videoPolling: false, videoId: null }))
          } else if (st.status === 'failed') {
            clearInterval(poll)
            setToolState(s => ({ ...s, videoError: st.error || 'Falha na geração', videoPolling: false }))
          }
        } catch (e) {
          clearInterval(poll)
          setToolState(s => ({ ...s, videoError: e.message, videoPolling: false }))
        }
      }, 10000)
    } catch (err) {
      setToolState(s => ({ ...s, videoError: err.message, videoLoading: false }))
    }
  }

  const handleCodeGenerate = async ({ lang, prompt }) => {
    setToolState(s => ({ ...s, codeLoading: true, codeError: null }))
    try {
      const data = await generateCode({ lang, prompt })
      const clean = data.code
        .trim()
        .replace(/^```[a-zA-Z]*\s*\n?/, '')
        .replace(/\n?```\s*$/, '')
      const result = `\`\`\`${lang}\n${clean}\n\`\`\``
      addMessage(result, 'assistant', `código ${lang}`)
    } catch (err) {
      setToolState(s => ({ ...s, codeError: err.message }))
    } finally {
      setToolState(s => ({ ...s, codeLoading: false }))
    }
  }

  const handleAppCreate = async (prompt) => {
    setToolState(s => ({ ...s, appLoading: true, appError: null }))
    try {
      const data = await generateApp({ prompt })
      addMessage(data.code, 'assistant', 'app gerado')
    } catch (err) {
      setToolState(s => ({ ...s, appError: err.message }))
    } finally {
      setToolState(s => ({ ...s, appLoading: false }))
    }
  }

  const handleAvatarGenerate = async (prompt) => {
    setToolState(s => ({ ...s, avatarLoading: true, avatarError: null, avatarResult: null }))
    try {
      const data = await generateDicebearAvatar({ seed: prompt })
      setToolState(s => ({ ...s, avatarResult: data.result }))
      const result = `<div>${data.result}</div>`
      addMessage(result, 'assistant', `avatar via ${data.model}`)
    } catch (err) {
      setToolState(s => ({ ...s, avatarError: err.message }))
    } finally {
      setToolState(s => ({ ...s, avatarLoading: false }))
    }
  }

  const closeTool = () => {
    setActiveTool(null)
    setToolState({})
    setShowTools(false)
  }

  if (!models.length) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 40 }}>
        <h2 style={{ marginBottom: 10 }}>Nenhum modelo ativo</h2>
        <p style={{ color: '#555' }}>
          Ative um fornecedor em <b>Fornecedores</b>.
        </p>
      </div>
    )
  }

  return (
    <div className="chat-shell" style={{ height: 'calc(100vh - 148px)' }}>
      <div className="chat-header">
        <div className="chat-model-select">
          <select
            className="input"
            style={{ width: 180 }}
            value={providerId}
            onChange={(e) => handleProviderChange(e.target.value)}
          >
            {[...new Set(models.map((m) => m.providerId))].map((id) => {
              const p = models.find((m) => m.providerId === id)
              return <option key={id} value={id}>{p.providerName}</option>
            })}
          </select>
          <select
            className="input"
            style={{ width: 240 }}
            value={model}
            onChange={(e) => handleModelChange(e.target.value)}
          >
            {availableModels.map((m) => (
              <option key={m.model} value={m.model}>{m.model}</option>
            ))}
          </select>
          <button className="btn" onClick={onNewConversation} title="Nova conversa">
            <Plus size={16} /> Nova
          </button>
        </div>
        <div className="badge">
          {providerId === 'ollama' && !ollamaOnline ? '⚠️ Ollama offline' : 'Mascarado como ' + brand.name}
        </div>
      </div>

      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="empty-state">
            <div className="big">🧠</div>
            <h2>Bem-vindo ao {brand.name}</h2>
            <p>
              Escolha um fornecedor e modelo acima, depois converse.
              As respostas chegam mascaradas como {brand.name}.
            </p>
            <div style={{ marginTop: 16, fontSize: 13, color: '#666' }}>
              Digite <b>/</b> para abrir ferramentas: Imagem, Vídeo, Código, App.
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role === 'user' ? 'user' : m.systemNote ? 'system-note' : 'assistant'}`}>
            <div dangerouslySetInnerHTML={{ __html: m.content.replace(/\n/g, '<br>') }} />
            {m.meta && <span className="msg-meta">{m.meta}</span>}
          </div>
        ))}

        {busy && <div className="typing"><span></span><span></span><span></span></div>}
        <div ref={bottomRef} />
      </div>

      {/* Tools Panel */}
      {activeTool && (
        <div className="tool-panel" style={{ borderTop: '1px solid #333', padding: 16, background: '#0a0a0a' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 15 }}>{activeTool === 'image' && '🎨 Gerar Imagem'
              || activeTool === 'video' && '🎬 Gerar Vídeo'
              || activeTool === 'code' && '👨‍💻 Gerar Código'
              || activeTool === 'app' && '🛠️ Criar App'}</h3>
            <button className="btn ghost" onClick={closeTool}><X size={16} /></button>
          </div>

          {activeTool === 'image' && (
            <div>
              <input className="input" placeholder="Descreva a imagem..." 
                value={toolState.imagePrompt || ''}
                onChange={e => setToolState(s => ({ ...s, imagePrompt: e.target.value }))}
                style={{ marginBottom: 8 }} />
              <button className="btn" onClick={() => handleImageGenerate(toolState.imagePrompt)} disabled={toolState.imageLoading}>
                {toolState.imageLoading ? 'Gerando...' : 'Gerar'}
              </button>
              {toolState.imageError && <p style={{ color: '#f66', marginTop: 8 }}>{toolState.imageError}</p>}
            </div>
          )}

          {activeTool === 'video' && (
            <div>
              <input className="input" placeholder="Descreva o vídeo..."
                value={toolState.videoPrompt || ''}
                onChange={e => setToolState(s => ({ ...s, videoPrompt: e.target.value }))}
                style={{ marginBottom: 8 }} />
              <button className="btn" onClick={() => handleVideoGenerate(toolState.videoPrompt)} disabled={toolState.videoLoading || toolState.videoPolling}>
                {toolState.videoLoading ? 'Enviando...' : toolState.videoPolling ? 'Gerando (pode levar 1-3 min)...' : 'Gerar'}
              </button>
              {toolState.videoError && <p style={{ color: '#f66', marginTop: 8 }}>{toolState.videoError}</p>}
            </div>
          )}

          {activeTool === 'code' && (
            <div>
              <select className="input" style={{ marginBottom: 8 }}
                value={toolState.codeLang || 'html'}
                onChange={e => setToolState(s => ({ ...s, codeLang: e.target.value }))}>
                <option value="html">HTML</option>
                <option value="js">JavaScript</option>
                <option value="css">CSS</option>
                <option value="python">Python</option>
                <option value="sql">SQL</option>
              </select>
              <textarea className="input" rows={3} placeholder="O que quer programar?"
                value={toolState.codePrompt || ''}
                onChange={e => setToolState(s => ({ ...s, codePrompt: e.target.value }))}
                style={{ marginBottom: 8 }} />
              <button className="btn" onClick={() => handleCodeGenerate({ lang: toolState.codeLang || 'html', prompt: toolState.codePrompt })} disabled={toolState.codeLoading}>
                {toolState.codeLoading ? 'Gerando...' : 'Gerar'}
              </button>
              {toolState.codeError && <p style={{ color: '#f66', marginTop: 8 }}>{toolState.codeError}</p>}
            </div>
          )}

          {activeTool === 'app' && (
            <div>
              <input className="input" placeholder="Descreva o app..."
                value={toolState.appPrompt || ''}
                onChange={e => setToolState(s => ({ ...s, appPrompt: e.target.value }))}
                style={{ marginBottom: 8 }} />
              <button className="btn" onClick={() => handleAppCreate(toolState.appPrompt)} disabled={toolState.appLoading}>
                {toolState.appLoading ? 'Criando...' : 'Criar App'}
              </button>
              {toolState.appError && <p style={{ color: '#f66', marginTop: 8 }}>{toolState.appError}</p>}
            </div>
          )}

          {activeTool === 'avatar' && (
            <div>
              <input className="input" placeholder="Digite o nome do avatar..."
                value={toolState.avatarPrompt || ''}
                onChange={e => setToolState(s => ({ ...s, avatarPrompt: e.target.value }))}
                style={{ marginBottom: 8 }} />
              <button className="btn" onClick={() => handleAvatarGenerate(toolState.avatarPrompt)} disabled={toolState.avatarLoading}>
                {toolState.avatarLoading ? 'Gerando...' : 'Gerar Avatar'}
              </button>
              {toolState.avatarError && <p style={{ color: '#f66', marginTop: 8 }}>{toolState.avatarError}</p>}
              {toolState.avatarResult && (
                <div style={{ marginTop: 16, textAlign: 'center' }}>
                  <div style={{ background: '#fff', padding: 20, borderRadius: 8, border: '1px solid #ddd', display: 'inline-block' }}>
                    <div dangerouslySetInnerHTML={{ __html: toolState.avatarResult }} />
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <button className="btn ghost" onClick={() => {
                      const blob = new Blob([toolState.avatarResult], { type: 'image/svg+xml' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `avatar-${toolState.avatarPrompt || 'dicebear'}.svg`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}>
                      Baixar Avatar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="chat-input-wrap">
        <div className="chat-input">
          <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
            <button className="btn ghost" style={{ padding: 6, fontSize: 14 }} onClick={() => { setActiveTool('image'); setShowTools(!showTools); }}>
              <Image size={16} /> Imagem
            </button>
            <button className="btn ghost" style={{ padding: 6, fontSize: 14 }} onClick={() => { setActiveTool('video'); setShowTools(!showTools); }}>
              <Video size={16} /> Vídeo
            </button>
            <button className="btn ghost" style={{ padding: 6, fontSize: 14 }} onClick={() => { setActiveTool('code'); setShowTools(!showTools); }}>
              <Code2 size={16} /> Código
            </button>
            <button className="btn ghost" style={{ padding: 6, fontSize: 14 }} onClick={() => { setActiveTool('app'); setShowTools(!showTools); }}>
              <Wrench size={16} /> App
            </button>
            <button className="btn ghost" style={{ padding: 6, fontSize: 14 }} onClick={() => { setActiveTool('avatar'); setShowTools(!showTools); }}>
              <div style={{ width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🧑‍🤖</div> Avatar
            </button>
            <button className="btn ghost" style={{ padding: 6, fontSize: 14 }} onClick={() => { setShowTools(!showTools); }}>
              <Menu size={16} /> Mais
            </button>
          </div>
          <div className="chat-input">
            <textarea
              rows={2}
              placeholder={`Conversar com ${brand.name}...`}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
            />
            <button className="btn" onClick={handleSend} disabled={busy || !input.trim()}>
              <Send size={16} />
              Enviar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}