import { generateAppCode, modifyAppCode, suggestImprovements, generateAppName } from '../lib/gemini.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' })
  }

  const { action, ...params } = req.body || {}
  if (!action) {
    return res.status(400).json({ error: 'action é obrigatório (generate|modify|suggest|name)' })
  }

  try {
    switch (action) {
      case 'generate': {
        const { prompt, model } = params
        if (!prompt || !prompt.trim()) return res.status(400).json({ error: 'prompt é obrigatório' })
        const code = await generateAppCode(prompt, model)
        return res.status(200).json({ code, provider: 'google' })
      }
      case 'modify': {
        const { code, prompt, model } = params
        if (!code || !prompt || !prompt.trim()) return res.status(400).json({ error: 'code e prompt são obrigatórios' })
        const result = await modifyAppCode({ code, prompt }, model)
        return res.status(200).json(result)
      }
      case 'suggest': {
        const { prompt, model } = params
        if (!prompt || !prompt.trim()) return res.status(400).json({ error: 'prompt é obrigatório' })
        const result = await suggestImprovements(prompt, model)
        return res.status(200).json(result)
      }
      case 'name': {
        const { prompt, model } = params
        if (!prompt || !prompt.trim()) return res.status(400).json({ error: 'prompt é obrigatório' })
        const name = await generateAppName(prompt, model)
        return res.status(200).json({ name })
      }
      default:
        return res.status(400).json({ error: `action inválida: ${action}` })
    }
  } catch (err) {
    return res.status(502).json({ error: err.message || 'Falha na operação' })
  }
}