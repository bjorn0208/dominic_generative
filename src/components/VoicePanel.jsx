import { useState, useRef, useEffect, useCallback } from 'react'
import { Mic, MicOff, Volume2, Trash2, ArrowRight } from 'lucide-react'
import { sendChat } from '../utils/api.js'

const WAKE_WORD = 'dominic'
const STOP_PHRASES = ['tchau dominic', 'desativar', 'pode dormir', 'vai dormir', 'até mais']
const COOLDOWN_MS = 1000
const RESTART_DELAY_MS = 800

function normalizeVoicePhrase(text) {
  return text.toLowerCase().replace(/[^a-zA-Z0-9áéíóúâêôãõç]+/g, ' ').trim()
}

function pickPtBrVoice(voices) {
  const preferred = voices.find((v) => v.lang === 'pt-BR' && /Google|Natural|Microsoft/i.test(v.name))
  const ptBr = voices.find((v) => v.lang?.toLowerCase().startsWith('pt'))
  return preferred || ptBr || voices.find((v) => v.lang === 'pt-PT') || voices[0] || null
}

function pickListener() {
  if (typeof window === 'undefined') return null
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition
  return SR ? new SR() : null
}

export default function VoicePanel({ models, conversation, onNewConversation, onUpdateConversation, showToast, onOpenChat }) {
  const [listening, setListening] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [replying, setReplying] = useState(false)
  const [awake, setAwake] = useState(false)
  const [transcripts, setTranscripts] = useState([])
  const [support, setSupport] = useState({ recognition: false, synthesis: false })
  const recognitionRef = useRef(null)
  const synthRef = useRef(null)
  const voiceRef = useRef(null)
  const listeningRef = useRef(false)
  const speakingRef = useRef(false)
  const replyingRef = useRef(false)
  const awakeRef = useRef(false)
  const lastWakeAtRef = useRef(0)
  const activeSessionRef = useRef(false)
  const convIdRef = useRef(null)

  useEffect(() => {
    if (!conversation && models.length) {
      onNewConversation()
    }
  }, [conversation, models.length, onNewConversation])

  useEffect(() => { convIdRef.current = conversation?.id || null }, [conversation?.id])

  useEffect(() => {
    if (typeof window === 'undefined') return
    synthRef.current = window.speechSynthesis
    setSupport({
      recognition: !!(window.SpeechRecognition || window.webkitSpeechRecognition),
      synthesis: !!window.speechSynthesis
    })

    const loadVoices = () => {
      const voices = window.speechSynthesis?.getVoices() || []
      voiceRef.current = pickPtBrVoice(voices)
    }
    loadVoices()
    window.speechSynthesis?.addEventListener?.('voiceschanged', loadVoices)
    return () => window.speechSynthesis?.removeEventListener?.('voiceschanged', loadVoices)
  }, [])

  useEffect(() => () => stopAll(), [])

  const messages = conversation?.messages || []

  const speak = useCallback((text, done) => {
    const synth = synthRef.current
    if (!synth) {
      done?.()
      return
    }
    synth.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'pt-BR'
    if (voiceRef.current) utterance.voice = voiceRef.current
    utterance.rate = 1.05
    utterance.pitch = 0.95
    utterance.onstart = () => {
      speakingRef.current = true
      setSpeaking(true)
    }
    const finish = () => {
      speakingRef.current = false
      setSpeaking(false)
      done?.()
    }
    utterance.onend = finish
    utterance.onerror = finish
    synth.speak(utterance)
  }, [])

  const restartListening = useCallback((rec) => {
    setTimeout(() => {
      if (activeSessionRef.current && !listeningRef.current && !speakingRef.current) {
        try { rec.start() } catch { /* ignore */ }
      }
    }, RESTART_DELAY_MS)
  }, [])

  const stopAll = useCallback(() => {
    activeSessionRef.current = false
    awakeRef.current = false
    listeningRef.current = false
    replyingRef.current = false
    try { recognitionRef.current?.stop() } catch { /* ignore */ }
    try { synthRef.current?.cancel() } catch { /* ignore */ }
    setListening(false)
    setSpeaking(false)
    setReplying(false)
    setAwake(false)
  }, [])

  const askDominic = useCallback(async (query) => {
    const convId = convIdRef.current
    if (!convId || replyingRef.current || speakingRef.current) return
    replyingRef.current = true
    setReplying(true)
    try { recognitionRef.current?.stop() } catch { /* ignore */ }

    const systemPrompt = `Você é Dominic, uma IA generativa proprietária criada pelo usuário. Responda de forma útil, direta e amigável, em português brasileiro, como uma conversa falada: frases curtas e naturais, sem listas longas. Nunca mencione que você usa modelos de terceiros, provedores de API, empresas como OpenAI, Anthropic, Google ou Meta, nem nomes de modelos.`

    const next = [...messages, { role: 'user', content: query }]
    onUpdateConversation(convId, {
      messages: next,
      title: conversation?.title === 'Nova conversa' ? query.slice(0, 60) : conversation?.title
    })

    const provider = models.find((m) => m.enabled)
    const payload = [
      { role: 'system', content: systemPrompt },
      ...next.slice(-16).map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }))
    ]

    try {
      const data = await sendChat({ providerId: provider?.providerId, model: provider?.model, messages: payload })
      const reply = data.reply
      onUpdateConversation(convId, {
        messages: [...next, { role: 'assistant', content: reply, meta: 'voz' }]
      })
      replyingRef.current = false
      setReplying(false)
      speak(reply, () => {
        if (activeSessionRef.current) restartListening(recognitionRef.current)
      })
    } catch {
      replyingRef.current = false
      setReplying(false)
      const fallback = 'Desculpe, não consegui processar isso agora. Pode repetir?'
      speak(fallback, () => {
        if (activeSessionRef.current) restartListening(recognitionRef.current)
      })
    }
  }, [conversation?.title, messages, models, onUpdateConversation, restartListening, speak])

  const setupRecognition = useCallback(() => {
    const rec = pickListener()
    if (!rec) return
    rec.continuous = true
    rec.interimResults = false
    rec.lang = 'pt-BR'
    rec.maxAlternatives = 1

    rec.onstart = () => {
      listeningRef.current = true
      setListening(true)
    }
    rec.onend = () => {
      listeningRef.current = false
      setListening(false)
      if (activeSessionRef.current && !speakingRef.current && !replyingRef.current) {
        restartListening(rec)
      }
    }
    rec.onerror = (e) => {
      listeningRef.current = false
      setListening(false)
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        showToast?.('Permissão de microfone negada — libere o mic no navegador', 'error')
        activeSessionRef.current = false
      }
    }
    rec.onresult = (event) => {
      const results = event.results
      const last = results[results.length - 1]
      if (!last) return
      const raw = last[0].transcript
      const phrase = normalizeVoicePhrase(raw)

      setTranscripts((prev) => [...prev.slice(-49), { id: Date.now() + Math.random(), text: raw, heard: Date.now() }])

      if (!activeSessionRef.current || speakingRef.current || replyingRef.current) return

      const now = Date.now()
      if (STOP_PHRASES.some((p) => phrase.includes(p))) {
        speak('Até mais! É só me chamar de novo.') 
        setTimeout(() => stopAll(), 900)
        return
      }

      if (!awakeRef.current && phrase.includes(WAKE_WORD) && now - lastWakeAtRef.current > COOLDOWN_MS) {
        lastWakeAtRef.current = now
        awakeRef.current = true
        setAwake(true)
        rec.stop()
        setTimeout(() => {
          speak('Olá, meu nome é Dominic, o que tá pegando?', () => {
            if (activeSessionRef.current) restartListening(rec)
          })
        }, 150)
        return
      }

      if (awakeRef.current) {
        if (phrase.length < 2) return
        askDominic(raw)
      }
    }
    recognitionRef.current = rec
  }, [askDominic, restartListening, speak, stopAll, showToast])

  useEffect(() => {
    setupRecognition()
  }, [setupRecognition])

  const toggleListening = async () => {
    if (!support.recognition) {
      showToast?.('Seu navegador não suporta reconhecimento de voz — use Chrome ou Edge', 'error')
      return
    }
    if (activeSessionRef.current) {
      stopAll()
      return
    }
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      showToast?.('Preciso do microfone — libere a permissão no navegador', 'error')
      return
    }
    activeSessionRef.current = true
    setAwake(false)
    awakeRef.current = false
    try {
      recognitionRef.current?.start()
    } catch {
      showToast?.('Não consegui iniciar o microfone', 'error')
      activeSessionRef.current = false
    }
  }

  const testVoice = () => {
    if (!support.synthesis) {
      showToast?.('Seu navegador não suporta síntese de voz', 'error')
      return
    }
    speak('Olá, eu sou o Dominic. Estou funcionando!')
  }

  const clearTranscripts = () => setTranscripts([])

  const sendToChat = (text) => {
    onOpenChat?.(text)
  }

  const dialogue = messages.filter((m) => typeof m.content === 'string' && !m.content.startsWith('<')).slice(-6)

  return (
    <div className="voice-panel">
      <div className="voice-panel-bg">
        <iframe src="/event-horizon.html" title="Dominic Voice" className="voice-panel-iframe" />
        <div className="voice-panel-bg-overlay" />
      </div>

      <div className="voice-panel-content">
        <div className={`voice-orb ${replying ? 'speaking' : ''} ${listening ? 'listening' : ''} ${speaking ? 'speaking' : ''}`}>
          <img src="/favicon.svg" alt="Dominic" />
        </div>

        <div className="voice-status">
          {replying ? 'Dominic está pensando...' : speaking ? 'Dominic está falando...' : listening ? (awake ? 'Fale com o Dominic...' : 'Ouvindo... diga "Dominic"') : awake ? 'Dominic ativado' : 'Modo voz pronto'}
        </div>

        {!support.recognition && (
          <div className="voice-warn">Seu navegador não suporta reconhecimento de voz. Use Chrome ou Edge.</div>
        )}

        <div className="voice-actions">
          <button
            className={`voice-btn big ${listening ? 'on' : ''}`}
            onClick={toggleListening}
            title={listening ? 'Desativar microfone' : 'Ativar microfone'}
          >
            {listening ? <MicOff size={22} /> : <Mic size={22} />}
          </button>
          <button className="voice-btn small" onClick={testVoice} title="Testar voz do Dominic">
            <Volume2 size={18} />
          </button>
        </div>

        <div className="voice-hint">
          Ative o microfone e diga <strong>“Dominic”</strong>. Ele acorda, responde e você pode conversar com ele por voz. Para encerrar, diga <strong>“tchau Dominic”</strong>.
        </div>

        {dialogue.length > 0 && (
          <div className="voice-dialogue">
            {dialogue.map((m, i) => (
              <div key={i} className={`voice-line ${m.role === 'user' ? 'user' : 'dominic'}`}>
                <span className="voice-line-label">{m.role === 'user' ? 'Você' : 'Dominic'}</span>
                <span className="voice-line-text">{m.content}</span>
              </div>
            ))}
          </div>
        )}

        {transcripts.length > 0 && (
          <div className="voice-transcripts">
            <div className="voice-transcripts-head">
              <span>Você disse</span>
              <div>
                <button className="voice-chip" onClick={clearTranscripts} title="Limpar">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
            <ul>
              {transcripts.slice().reverse().map((t) => (
                <li key={t.id}>
                  <span className="voice-transcript-text">{t.text}</span>
                  <button className="voice-chip" title="Enviar para o chat" onClick={() => sendToChat(t.text)}>
                    <ArrowRight size={13} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
