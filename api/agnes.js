import { submitVideo, getVideoStatus } from '../lib/agnes.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') return res.status(204).end()

  const { action, ...params } = req.body || {}

  if (req.method === 'GET') {
    if (req.query.action === 'status') {
      const { id } = req.query
      if (!id) return res.status(400).json({ error: 'id é obrigatório' })
      try {
        const result = await getVideoStatus(id)
        return res.status(200).json(result)
      } catch (err) {
        return res.status(502).json({ error: err.message || 'Falha ao consultar status' })
      }
    }
    return res.status(405).json({ error: 'Método não permitido' })
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' })
  }

  if (!action) {
    return res.status(400).json({ error: 'action é obrigatório (submit|status)' })
  }

  try {
    switch (action) {
      case 'submit': {
        const { prompt, duration, aspect } = params
        if (!prompt || !prompt.trim()) return res.status(400).json({ error: 'prompt é obrigatório' })
        const result = await submitVideo({ prompt, duration, aspect })
        return res.status(200).json(result)
      }
      case 'status': {
        const { id } = params
        if (!id) return res.status(400).json({ error: 'id é obrigatório' })
        const result = await getVideoStatus(id)
        return res.status(200).json(result)
      }
      default:
        return res.status(400).json({ error: `action inválida: ${action}` })
    }
  } catch (err) {
    return res.status(502).json({ error: err.message || 'Falha na operação' })
  }
}