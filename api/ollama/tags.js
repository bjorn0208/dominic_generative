import { timeoutFetch } from '../../lib/hf.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') return res.status(204).end()

  try {
    const r = await timeoutFetch('http://localhost:11434/api/tags')
    if (!r.ok) {
      return res.status(502).json({ error: `Ollama indisponível (${r.status}). Instale e inicie o Ollama.` })
    }
    const data = await r.json()
    return res.status(200).json(data)
  } catch (err) {
    return res.status(502).json({ error: `Ollama indisponível: ${err.message}` })
  }
}