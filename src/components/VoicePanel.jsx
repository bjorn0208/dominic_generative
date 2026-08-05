import { useState, useRef, useEffect, useCallback } from 'react'
import { Mic, MicOff, Volume2, Trash2, ArrowRight, AudioLines } from 'lucide-react'
import { sendChat } from '../utils/api.js'

const WAKE_WORD = 'dominic'
const STOP_PHRASES = ['tchau dominic', 'desativar', 'pode dormir', 'vai dormir', 'até mais']
const COOLDOWN_MS = 1000
const RESTART_DELAY_MS = 800
const WATCHDOG_MS = 2500
const MAX_UTTERANCE_MS = 25000

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
  const [lastError, setLastError] = useState(null)
  const [transcripts, setTranscripts] = useState([])
  const [support, setSupport] = useState({ recognition: false, synthesis: false })
  const [jarvisOnline, setJarvisOnline] = useState(false)
  const [recording, setRecording] = useState(false)
  const recognitionRef = useRef(null)
  const synthRef = useRef(null)
  const voiceRef = useRef(null)
  const audioRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const recordingChunksRef = useRef([])
  const recordingRef = useRef(false)
  const listeningRef = useRef(false)
  const speakingRef = useRef(false)
  const replyingRef = useRef(false)
  const awakeRef = useRef(false)
  const lastWakeAtRef = useRef(0)
  const activeSessionRef = useRef(false)
  const convIdRef = useRef(null)
  const modelsRef = useRef([])
  const messagesRef = useRef([])
  const titleRef = useRef('Nova conversa')
  const jarvisOnlineRef = useRef(false)

  useEffect(() => { jarvisOnlineRef.current = jarvisOnline }, [jarvisOnline])
  useEffect(() => { modelsRef.current = models || [] }, [models])
  useEffect(() => { messagesRef.current = conversation?.messages || [] }, [conversation?.messages])
  useEffect(() => { titleRef.current = conversation?.title || 'Nova conversa' }, [conversation?.title])
  useEffect(() => {
    if (!conversation && models.length) {
      onNewConversation()
    }
  }, [conversation, models.length, onNewConversation])

  useEffect(() => { convIdRef.current = conversation?.id || null }, [conversation?.id])

  useEffect(() => {
    fetch('/api/jarvis/transcribe')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('offline'))))
      .then((d) => setJarvisOnline(d.status === 'ok'))
      .catch(() => setJarvisOnline(false))
  }, [])

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

  const speak = useCallback((text, done) => {
    speakingRef.current = true
    setSpeaking(true)
    const finish = () => {
      clearTimeout(safety)
      speakingRef.current = false
      setSpeaking(false)
      done?.()
    }
    const safety = setTimeout(() => {
      if (speakingRef.current) finish()
    }, MAX_UTTERANCE_MS)
    const speakBrowser = () => {
      const synth = synthRef.current
      if (!synth) {
        finish()
        return
      }
      try { synth.cancel() } catch { /* ignore */ }
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'pt-BR'
      if (voiceRef.current) utterance.voice = voiceRef.current
      utterance.rate = 1.05
      utterance.pitch = 0.95
      utterance.onend = finish
      utterance.onerror = finish
      synth.speak(utterance)
    }
    const speakNeural = () => {
      fetch('/api/jarvis/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      })
        .then(async (r) => {
          if (!r.ok) throw new Error('tts offline')
          const blob = await r.blob()
          const url = URL.createObjectURL(blob)
          const audio = new Audio(url)
          audioRef.current = audio
          audio.onended = () => {
            URL.revokeObjectURL(url)
            clearTimeout(safety)
            finish()
          }
          audio.onerror = () => {
            URL.revokeObjectURL(url)
            speakBrowser()
          }
          audio.play().catch(() => {
            URL.revokeObjectURL(url)
            speakBrowser()
          })
        })
        .catch(() => speakBrowser())
    }
    try { audioRef.current?.pause() } catch { /* ignore */ }
    if (jarvisOnlineRef.current) speakNeural()
    else speakBrowser()
  }, [])

  const restartListening = useCallback((rec) => {
    setTimeout(() => {
      if (activeSessionRef.current && !listeningRef.current && !speakingRef.current && !replyingRef.current) {
        try {
          rec.start()
        } catch { /* ignore */ }
      }
    }, RESTART_DELAY_MS)
  }, [])

  const stopAll = useCallback(() => {
    activeSessionRef.current = false
    awakeRef.current = false
    listeningRef.current = false
    replyingRef.current = false
    speakingRef.current = false
    try { recognitionRef.current?.stop() } catch { /* ignore */ }
    try { synthRef.current?.cancel() } catch { /* ignore */ }
    setListening(false)
    setSpeaking(false)
    setReplying(false)
    setAwake(false)
  }, [])

  const askDominic = useCallback(async (query) => {
    const convId = convIdRef.current
    if (!convId) {
      console.warn('[voz] sem conversa ativa')
      setLastError('Nenhuma conversa ativa. Recarregue a página.')
      showToast?.('Nenhuma conversa ativa', 'error')
      return
    }
    if (replyingRef.current || speakingRef.current) {
      console.warn('[voz] ocupado — ignorando fala')
      return
    }
    replyingRef.current = true
    setReplying(true)
    setLastError(null)
    try { recognitionRef.current?.stop() } catch { /* ignore */ }

    const systemPrompt = `Você é Dominic, uma IA generativa proprietária criada pelo usuário. Responda de forma útil, direta e amigável, em português brasileiro, como uma conversa falada: frases curtas e naturais, sem listas longas. Nunca mencione que você usa modelos de terceiros, provedores de API, empresas como OpenAI, Anthropic, Google ou Meta, nem nomes de modelos.`

    const current = messagesRef.current
    const next = [...current, { role: 'user', content: query }]
    onUpdateConversation(convId, {
      messages: next,
      title: titleRef.current === 'Nova conversa' ? query.slice(0, 60) : titleRef.current
    })

    const fallbackModel = { providerId: 'groq', model: null }
    const provider = modelsRef.current[0] || fallbackModel
    const payload = [
      { role: 'system', content: systemPrompt },
      ...next.slice(-16).map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }))
    ]

    try {
      console.log('[voz] enviando para', provider.providerId, provider.model)
      const data = await sendChat({ providerId: provider.providerId, model: provider.model, messages: payload })
      const reply = data.reply
      console.log('[voz] resposta recebida:', reply.slice(0, 60))
      onUpdateConversation(convId, {
        messages: [...next, { role: 'assistant', content: reply, meta: 'voz' }]
      })
      replyingRef.current = false
      setReplying(false)
      speak(reply, () => {
        if (activeSessionRef.current) restartListening(recognitionRef.current)
      })
    } catch (err) {
      console.error('[voz] erro na API:', err)
      replyingRef.current = false
      setReplying(false)
      setLastError(`API: ${err.message}`)
      const fallback = 'Desculpe, não consegui processar isso agora. Pode repetir?'
      speak(fallback, () => {
        if (activeSessionRef.current) restartListening(recognitionRef.current)
      })
    }
  }, [onUpdateConversation, restartListening, showToast, speak])

  useEffect(() => {
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
      console.error('[voz] erro de reconhecimento:', e.error)
      listeningRef.current = false
      setListening(false)
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        showToast?.('Permissão de microfone negada — libere o mic no navegador', 'error')
        activeSessionRef.current = false
      } else if (activeSessionRef.current && !speakingRef.current && !replyingRef.current) {
        setTimeout(() => {
          if (activeSessionRef.current && !listeningRef.current) {
            try { rec.start() } catch { /* ignore */ }
          }
        }, 1000)
      }
    }
    rec.onresult = (event) => {
      const results = event.results
      const last = results[results.length - 1]
      if (!last) return
      const raw = last[0].transcript
      const phrase = normalizeVoicePhrase(raw)
      console.log('[voz] ouvi:', phrase)
      setTranscripts((prev) => [...prev.slice(-49), { id: Date.now() + Math.random(), text: raw, heard: Date.now() }])

      if (!activeSessionRef.current || speakingRef.current || replyingRef.current) return

      const now = Date.now()
      if (STOP_PHRASES.some((p) => phrase.includes(p))) {
        awakeRef.current = false
        setAwake(false)
        speak('Até mais! É só me chamar de novo.')
        setTimeout(() => stopAll(), 900)
        return
      }

      if (!awakeRef.current && phrase.includes(WAKE_WORD) && now - lastWakeAtRef.current > COOLDOWN_MS) {
        lastWakeAtRef.current = now
        awakeRef.current = true
        setAwake(true)
        setLastError(null)
        try { rec.stop() } catch { /* ignore */ }
        setTimeout(() => {
          speak('Olá, meu nome é Dominic, o que tá pegando?', () => {
            if (activeSessionRef.current) restartListening(rec)
          })
        }, 150)
        return
      }

      if (awakeRef.current && phrase.length >= 2) {
        askDominic(raw)
      }
    }
    recognitionRef.current = rec
  }, [askDominic, restartListening, speak, stopAll, showToast])

  // Watchdog: religa o mic sozinho se o reconhecimento morrer
  useEffect(() => {
    const timer = setInterval(() => {
      if (!activeSessionRef.current) return
      const rec = recognitionRef.current
      if (rec && !listeningRef.current && !speakingRef.current && !replyingRef.current) {
        try {
          rec.start()
        } catch { /* ignore */ }
      }
    }, WATCHDOG_MS)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => () => stopAll(), [stopAll])

  const startRecording = async () => {
    if (recordingRef.current) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      const recorder = new MediaRecorder(stream, { mimeType: mime })
      recordingChunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordingChunksRef.current.push(e.data)
      }
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(recordingChunksRef.current, { type: mime })
        const ext = mime.includes('mp4') ? 'm4a' : 'webm'
        await transcribeBlob(blob, ext)
        recordingRef.current = false
        setRecording(false)
      }
      recorder.start()
      mediaRecorderRef.current = recorder
      recordingRef.current = true
      setRecording(true)
    } catch {
      showToast?.('Preciso do microfone — libere a permissão no navegador', 'error')
    }
  }

  const stopRecording = () => {
    try { mediaRecorderRef.current?.stop() } catch { /* ignore */ }
  }

  const transcribeBlob = async (blob, ext) => {
    setLastError(null)
    try {
      const r = await fetch('/api/jarvis/transcribe', { method: 'POST', body: blob })
      const data = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(data.error || 'falha ao transcrever')
      const raw = (data.text || '').trim()
      if (!raw) {
        showToast?.('Não entendi o que você falou. Tente de novo.', 'error')
        return
      }
      console.log('[voz] transcrito:', raw)
      setTranscripts((prev) => [...prev.slice(-49), { id: Date.now() + Math.random(), text: raw, heard: Date.now() }])
      const phrase = normalizeVoicePhrase(raw)
      if (STOP_PHRASES.some((p) => phrase.includes(p))) {
        awakeRef.current = false
        setAwake(false)
        speak('Até mais! É só me chamar de novo.')
        setTimeout(() => stopAll(), 900)
        return
      }
      if (!awakeRef.current) {
        if (phrase.includes(WAKE_WORD)) {
          awakeRef.current = true
          setAwake(true)
          speak('Olá, meu nome é Dominic, o que tá pegando?')
          return
        }
        showToast?.('Diga "Dominic" primeiro para ativar.', 'error')
        return
      }
      askDominic(raw)
    } catch (err) {
      console.error('[voz] erro na transcrição:', err)
      setLastError(`Transcrição: ${err.message}`)
      showToast?.('Falha ao transcrever o áudio', 'error')
    }
  }

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
    setLastError(null)
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

  const dialogue = messagesRef.current
    .filter((m) => typeof m.content === 'string' && !m.content.startsWith('<'))
    .slice(-6)

  return (
    <div className="voice-panel">
      <div className="voice-panel-bg">
        <iframe src="/event-horizon.html" title="Dominic Voice" className="voice-panel-iframe" />
        <div className="voice-panel-bg-overlay" />
      </div>

      <div className="voice-panel-content">
        <div className={`voice-orb ${replying || speaking ? 'speaking' : ''} ${listening ? 'listening' : ''}`}>
          <img src="/favicon.svg" alt="Dominic" />
        </div>

        <div className="voice-status">
          {replying ? 'Dominic está pensando...' : speaking ? 'Dominic está falando...' : listening ? (awake ? 'Fale com o Dominic...' : 'Ouvindo... diga "Dominic"') : awake ? 'Dominic ativado' : 'Modo voz pronto'}
        </div>

        {lastError && (
          <div className="voice-warn">⚠️ {lastError}</div>
        )}

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
          <button
            className={`voice-btn big hold ${recording ? 'rec' : ''}`}
            onPointerDown={(e) => { e.preventDefault(); startRecording() }}
            onPointerUp={stopRecording}
            onPointerLeave={stopRecording}
            onPointerCancel={stopRecording}
            title="Segure para falar (transcrição por servidor)"
          >
            <AudioLines size={22} />
          </button>
          <button className="voice-btn small" onClick={testVoice} title="Testar voz do Dominic">
            <Volume2 size={18} />
          </button>
        </div>

        <div className="voice-hint">
          {recording
            ? 'Gravando... solte para enviar'
            : jarvisOnline
              ? 'Segure o botão verde para falar, ou use o microfone e diga "Dominic".'
              : 'Ative o microfone e diga "Dominic", ou segure o botão verde para falar.'}
          {jarvisOnline && (
            <span className="jarvis-chip">✓ Voz neural ativa</span>
          )}
          Para encerrar, diga <strong>“tchau Dominic”</strong>.
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
