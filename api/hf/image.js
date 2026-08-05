import { generateImage } from '../../lib/hf.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' })
  }

  const { model, prompt } = req.body || {}
  if (!prompt || !prompt.trim()) {
    return res.status(400).json({ error: 'prompt é obrigatório' })
  }

  try {
    const image = await generateImage({ model, prompt })
    return res.status(200).json(image)
  } catch (err) {
    return res.status(502).json({ error: err.message || 'Falha na geração de imagem' })
  }
}