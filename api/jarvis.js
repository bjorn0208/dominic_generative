export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') return res.status(204).end()
  res.status(503).json({
    error: 'jarvis-offline',
    detail: 'Serviço Jarvis Python não está rodando neste ambiente (Vercel). Rode o launch.sh localmente para ativar a voz neural.'
  })
}
