import { loadConfig } from '../lib/config.js'
import { chatWithProvider } from '../lib/hf.js'
import { query, closePoolAfterResponse } from '../lib/db.js'

const LANG_INSTRUCTIONS = {
  html: 'Gere um arquivo HTML único e completo (com <!doctype html>, CSS inline em <style> e JavaScript em <script>), pronto para abrir no navegador.',
  css: 'Gere apenas o CSS, bem organizado e com comentários em seções.',
  js: 'Gere apenas JavaScript puro, sem dependências externas, pronto para rodar em um navegador (use console.log e manipulação de DOM).',
  python: 'Gere um script Python completo e executável, sem dependências externas.',
  sql: 'Gere apenas o SQL (DDL e DML), compatível com PostgreSQL.',
  react: 'Gere um componente React funcional completo em um único arquivo JSX, sem dependências externas além de React.'
}

const SYSTEM_PROMPT =
  'Você é um engenheiro de software sênior. Responda APENAS com o código-fonte completo solicitado pelo usuário, sem introdução, sem explicações, sem comentários desnecessários e SEM cercas de markdown (sem ```). O código deve estar pronto para copiar e executar.'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')

  if (req.method === 'OPTIONS') return res.status(204).end()

  closePoolAfterResponse(res)
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' })
  }

  const { lang, prompt } = req.body || {}
  if (!prompt || !prompt.trim()) {
    return res.status(400).json({ error: 'prompt é obrigatório' })
  }

  const config = await loadConfig()
  const provider =
    config.providers.find((p) => p.id === 'groq' && p.enabled) ||
    config.providers.find((p) => p.enabled)
  if (!provider) {
    return res.status(400).json({ error: 'Nenhum provedor habilitado' })
  }

  const preferredModel = 'llama-3.3-70b-versatile'
  const selectedModel = provider.models.includes(preferredModel) ? preferredModel : provider.models[0]
  const effectiveApiKey = provider.apiKey || ''
  const langInstruction = LANG_INSTRUCTIONS[lang] || ''

  const messagesToSend = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `${langInstruction}\n\nSolicitação do usuário:\n${prompt}` }
  ]

  try {
    const { reply, usage } = await chatWithProvider(provider, selectedModel, effectiveApiKey, messagesToSend)
    if (process.env.DATABASE_URL) {
      try {
        await query(
          `INSERT INTO usage_logs (provider_id, model, prompt_tokens, completion_tokens, total_tokens)
           VALUES ($1,$2,$3,$4,$5)`,
          [
            provider.id,
            selectedModel,
            usage?.prompt_tokens ?? 0,
            usage?.completion_tokens ?? 0,
            usage?.total_tokens ?? 0
          ]
        )
      } catch (dbErr) {
        console.error('Falha ao registrar uso no banco:', dbErr.message)
      }
    }
    return res.status(200).json({
      code: reply || '',
      lang: lang || 'text',
      model: selectedModel,
      provider: { id: provider.id, name: provider.name }
    })
  } catch (err) {
    return res.status(502).json({ error: `Falha ao contactar ${provider.name}: ${err.message}` })
  }
}
