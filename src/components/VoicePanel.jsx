import { useState, useRef, useEffect, useCallback } from 'react'
import { Mic, MicOff, Volume2, Trash2, ArrowRight } from 'lucide-react'

const WAKE_WORD = 'dominic'
const COOLDOWN_MS = 1000
const RESTART_DELAY_MS = 1200

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

export default function VoicePanel({ showToast, onOpenChat }) {
  const [listening, setListening] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [transcripts, setTranscripts] = useState([])
  const [wakeHeard, setWakeHeard] = useState(false)
  const [support, setSupport] = useState({ recognition: false, synthesis: false })
  const recognitionRef = useRef(null)
  const synthRef = useRef(null)
  const voiceRef = useRef(null)
  const listeningRef = useRef(false)
  const speakingRef = useRef(false)
  const lastWakeAtRef = useRef(0)
  const activeSessionRef = useRef(false)

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
    utterance.onend = () => {
      speakingRef.current = false
      setSpeaking(false)
      done?.()
    }
    utterance.onerror = () => {
      speakingRef.current = false
      setSpeaking(false)
      done?.()
    }
    synth.speak(utterance)
  }, [])

  const stopAll = useCallback(() => {
    activeSessionRef.current = false
    listeningRef.current = false
    try { recognitionRef.current?.stop() } catch { /* ignore */ }
    try { synthRef.current?.cancel() } catch { /* ignore */ }
    setListening(false)
    setSpeaking(false)
  }, [])

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
      if (activeSessionRef.current && !speakingRef.current) {
        setTimeout(() => {
          if (activeSessionRef.current && !listeningRef.current) {
            try { rec.start() } catch { /* ignore */ }
          }
        }, RESTART_DELAY_MS)
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

      if (!activeSessionRef.current || speakingRef.current) return

      const now = Date.now()
      if (phrase.includes(WAKE_WORD) && now - lastWakeAtRef.current > COOLDOWN_MS) {
        lastWakeAtRef.current = now
        setWakeHeard(true)
        rec.stop()
        setTimeout(() => {
          speak('Olá, meu nome é Dominic, o que tá pegando?', () => {
            if (activeSessionRef.current) {
              try { rec.start() } catch { /* ignore */ }
            }
          })
        }, 150)
      }
    }
    recognitionRef.current = rec
  }, [speak, showToast])

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
    setWakeHeard(false)
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

  return (
    <div className="voice-panel">
      <div className="voice-panel-bg">
        <iframe src="/event-horizon.html" title="Dominic Voice" className="voice-panel-iframe" />
        <div className="voice-panel-bg-overlay" />
      </div>

      <div className="voice-panel-content">
        <div className={`voice-orb ${listening ? 'listening' : ''} ${speaking ? 'speaking' : ''}`}>
          <img src="/favicon.svg" alt="Dominic" />
        </div>

        <div className="voice-status">
          {speaking ? 'Dominic está falando...' : listening ? 'Ouvindo... fale "Dominic" para ativar' : wakeHeard ? 'Dominic ativado!' : 'Modo voz pronto'}
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
          Ative o microfone e diga <strong>“Dominic”</strong> — ele responde com voz e você pode conversar.
        </div>

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
