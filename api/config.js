import { loadConfig, saveConfig } from '../lib/config.js'
import { closePoolAfterResponse } from '../lib/db.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS')

  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  closePoolAfterResponse(res)

  if (req.method === 'GET') {
    const config = await loadConfig()
    const safe = JSON.parse(JSON.stringify(config))
    for (const p of safe.providers) {
      if (p.apiKey) p.apiKey = `•••• ${p.apiKey.slice(-4)}`
    }
    if (safe.huggingface?.apiKey) {
      safe.huggingface.apiKey = `•••• ${safe.huggingface.apiKey.slice(-4)}`
    }
    return res.status(200).json(safe)
  }

  if (req.method === 'PUT') {
    const body = req.body
    const config = await loadConfig()

    if (body.providers) {
      for (const incoming of body.providers) {
        const existing = config.providers.find((p) => p.id === incoming.id)
        if (!existing) continue
        if (!incoming.apiKey || incoming.apiKey.startsWith('••••')) {
          delete incoming.apiKey
        } else {
          incoming.apiKey = incoming.apiKey.trim()
        }
        Object.assign(existing, incoming)
      }
    }
    if (body.huggingface) {
      const hf = config.huggingface
      if (body.huggingface.apiKey && body.huggingface.apiKey.startsWith('••••')) {
        delete body.huggingface.apiKey
      }
      Object.assign(hf, body.huggingface)
    }
    if (body.branding) {
      Object.assign(config.branding, body.branding)
    }
    await saveConfig(config)
    return res.status(200).json({ ok: true })
  }

  return res.status(405).json({ error: 'Método não permitido' })
}