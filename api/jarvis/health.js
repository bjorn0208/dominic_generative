export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') return res.status(204).end()
  res.status(200).json({ status: 'ok', service: 'Dominic Jarvis', tts: true, stt: false, brain: false, remote: true })
}
