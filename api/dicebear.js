export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' })
  }

  const { seed, style = 'clay', size = 128 } = req.body || {}
  if (!seed || !seed.trim()) {
    return res.status(400).json({ error: 'seed é obrigatório' })
  }

  try {
    const url = `https://api.dicebear.com/10.x/${style}/svg?seed=${encodeURIComponent(seed)}&size=${encodeURIComponent(size)}`
    const svg = await fetch(url)
    if (!svg.ok) {
      return res.status(502).json({ error: `Dicebear API falhou: ${svg.status}` })
    }
    const svgContent = await svg.text()
    return res.status(200).json({
      model: `dicebear/${style}`,
      result: svgContent,
      mimeType: 'image/svg+xml',
      seed,
      style,
      size
    })
  } catch (err) {
    return res.status(502).json({ error: err.message || 'Falha na geração de avatar' })
  }
}