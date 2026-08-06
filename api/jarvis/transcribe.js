import { loadConfig } from '../../lib/config.js'

export const config = { api: { bodyParser: false } }

const GROQ_URL = 'https://api.groq.com/openai/v1/audio/transcriptions'
const GROQ_MODEL = 'whisper-large-v3-turbo'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method === 'GET') {
    return res.status(200).json({ status: 'ok', service: 'Dominic Jarvis', tts: true, stt: true, brain: false, remote: true })
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' })

  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const body = Buffer.concat(chunks)
  if (body.length === 0) return res.status(400).json({ error: 'áudio vazio' })

  let apiKey = ''
  let apiKeyBackup = ''
  try {
    const cfg = await loadConfig()
    const groq = cfg.providers.find((p) => p.id === 'groq')
    apiKey = groq?.apiKey || ''
    apiKeyBackup = groq?.apiKeyBackup || ''
  } catch { /* ignore */ }
  if (!apiKey) return res.status(500).json({ error: 'API_KEY_GROQ não configurada' })

  const mime = req.headers['content-type'] || 'audio/webm'
  const ext = mime.includes('mp4') ? 'm4a' : mime.includes('ogg') ? 'ogg' : mime.includes('wav') ? 'wav' : 'webm'

  const callWhisper = async (key) => {
    const form = new FormData()
    form.append('model', GROQ_MODEL)
    form.append('language', 'pt')
    form.append('file', new Blob([body], { type: mime }), `audio.${ext}`)
    const upstream = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: form
    })
    const data = await upstream.json()
    if (!upstream.ok) throw new Error(`${upstream.status} ${data.error?.message || 'Falha no Whisper'}`)
    return data.text || ''
  }

  try {
    let text
    try {
      text = await callWhisper(apiKey)
    } catch (err) {
      if (!apiKeyBackup || !/(401|402|429)/.test(err.message)) throw err
      text = await callWhisper(apiKeyBackup)
    }
    res.status(200).json({ text })
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
}
