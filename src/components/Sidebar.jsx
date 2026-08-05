import { useState, useEffect } from 'react'
import { MessageSquare, KeyRound, Code2, Wrench, Plus, Trash2, ChevronRight, Image as ImageIcon, Video, Sparkles } from 'lucide-react'

const NAV = [
  { id: 'chat', label: 'Conversar', icon: MessageSquare },
  { id: 'providers', label: 'Fornecedores', icon: KeyRound },
  { id: 'code', label: 'Programar', icon: Code2 },
  { id: 'app', label: 'Criar App', icon: Wrench }
]

const TOOLS = [
  { id: 'image', label: 'Imagem', icon: ImageIcon },
  { id: 'video', label: 'Vídeo', icon: Video },
  { id: 'code', label: 'Código', icon: Code2 },
  { id: 'app', label: 'App', icon: Wrench },
  { id: 'avatar', label: 'Avatar', icon: Sparkles }
]

export default function Sidebar({ brand, view, setView, providerCount, conversations, activeConvId, onNewConversation, onSelectConversation, onDeleteConversation, onOpenTool }) {
  const [expanded, setExpanded] = useState(false)
  const [hoverTimer, setHoverTimer] = useState(null)

  const handleMouseEnter = () => {
    const timer = setTimeout(() => setExpanded(true), 100)
    setHoverTimer(timer)
  }

  const handleMouseLeave = () => {
    if (hoverTimer) clearTimeout(hoverTimer)
    const timer = setTimeout(() => setExpanded(false), 2000)
    setHoverTimer(timer)
  }

  useEffect(() => () => { if (hoverTimer) clearTimeout(hoverTimer) }, [hoverTimer])

  return (
    <aside className={`sidebar ${expanded ? 'expanded' : 'collapsed'}`} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <div className="sidebar-logo">
        <div className="logo-badge">
          <img src="/favicon.svg" alt="Dominic" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 12 }} />
        </div>
        <div className="logo-text">
          <h1>{brand.name}</h1>
          <p>{brand.tagline}</p>
        </div>
      </div>

      <nav className="sidebar-nav">
        {NAV.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={`nav-item ${view === id ? 'active' : ''}`}
            onClick={() => setView(id)}
          >
            <Icon size={18} />
            {expanded && <span>{label}</span>}
          </button>
        ))}
      </nav>

      <div className="sidebar-tools">
        <div className="sidebar-section-title">
          {expanded && <span>Ferramentas</span>}
        </div>
        {TOOLS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className="tool-item"
            onClick={() => onOpenTool(id)}
            title={label}
          >
            <Icon size={17} />
            {expanded && <span>{label}</span>}
          </button>
        ))}
      </div>

      <div className="sidebar-conversations">
        <div className="sidebar-section-title">
          {expanded && <span>Conversas</span>}
          <button className="mini-btn" title="Nova conversa" onClick={onNewConversation}>
            <Plus size={14} />
          </button>
        </div>
        <div className="conv-list">
          {conversations.length === 0 && (
            <div style={{ padding: '8px 4px', color: '#999', fontSize: 13 }}>
              Nenhuma conversa ainda.
            </div>
          )}
          {conversations.map((c) => (
            <div
              key={c.id}
              className={`conv-item ${c.id === activeConvId ? 'active' : ''}`}
              onClick={() => onSelectConversation(c.id)}
              title={c.title}
            >
              <span className="conv-title">{c.title || 'Nova conversa'}</span>
              <button
                className="mini-btn"
                title="Excluir"
                onClick={(e) => {
                  e.stopPropagation()
                  onDeleteConversation(c.id)
                }}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="sidebar-footer">
        {expanded && (
          <>
            <span>⚡ {providerCount} fornecedores ativos</span>
            <br />
            <span style={{ opacity: 0.8 }}>● Ollama offline</span>
          </>
        )}
      </div>

      <button className="sidebar-toggle" onClick={() => setExpanded(!expanded)} aria-label={expanded ? 'Recolher' : 'Expandir'}>
        <ChevronRight size={18} style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }} />
      </button>
    </aside>
  )
}
