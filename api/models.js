import { loadConfig } from '../lib/config.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') return res.status(204).end()

  const config = await loadConfig()
  const models = []
  for (const p of config.providers) {
    if (!p.enabled) continue
    for (const m of p.models) {
      models.push({ providerId: p.id, providerName: p.name, model: m })
    }
  }
  return res.status(200).json(models)
}