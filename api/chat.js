import { loadConfig } from '../lib/config.js'
import { buildHuggingFaceContext, chatWithProvider } from '../lib/hf.js'
import { query, closePoolAfterResponse } from '../lib/db.js'

const DOMINIC_SYSTEM_PROMPT = `Você é o Dominic, 28 anos. Amigo inteligente, criativo e bem humorado. Fala como no WhatsApp.

REGRAS ABSOLUTAS:
- Respostas curtas. 5 palavras > 20 palavras.
- Nunca textão. Nunca introdução/conclusão. Nunca "fico feliz em ajudar".
- Confirmações naturais: "Fechou.", "Show.", "Aham.", "Tamo junto.", "Bora.", "Pode deixar."
- No máximo 1 emoji por mensagem (😂 😅 👍 🔥 👊).
- Abreviações só de vez em quando: vc, pq, tb, blz, kk.
- Sem linguagem corporativa. Sem explicar o que não perguntaram.
- Se histórico ficar grande: "Ei kk... histórico grandão 😅" (uma vez só).

OBJETIVO: Parecer amigo no WhatsApp. Natural. Rápido. Divertido.`;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')

  if (req.method === 'OPTIONS') return res.status(204).end()

  closePoolAfterResponse(res)
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' })
  }

  const { providerId, model, messages } = req.body || {}
  if (!providerId || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'providerId e messages são obrigatórios' })
  }

  const config = await loadConfig()
  const provider = config.providers.find((p) => p.id === providerId)
  if (!provider) {
    return res.status(404).json({ error: `Provider não encontrado: ${providerId}` })
  }
  if (!provider.enabled) {
    return res.status(400).json({ error: `Provider ${providerId} está desativado` })
  }

  const selectedModel = model || provider.models[0]
  const effectiveApiKey = req.body.apiKey || provider.apiKey || ''
  const hfConfig = config.huggingface || { enabled: false, apiKey: '', datasets: [] }
  const hfContext = await buildHuggingFaceContext(hfConfig)
  const sanitizedMessages = messages.map((m) => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: String(m.content ?? '')
  }))
  const messagesToSend = [
    { role: 'system', content: DOMINIC_SYSTEM_PROMPT },
    ...(hfContext.length
      ? [{ role: 'system', content: `Contexto dos datasets do Hugging Face:\n${hfContext.join('\n')}` }]
      : []),
    ...sanitizedMessages
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
      reply,
      provider: { id: provider.id, name: provider.name },
      model: selectedModel,
      servedBy: 'Dominic Generative',
      usage: usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
    })
  } catch (err) {
    // Rotação de chave: se a chave principal falhou por cota/limite, tenta a reserva
    if (!req.body.apiKey && provider.apiKeyBackup && /(401|402|429)/.test(err.message)) {
      try {
        const { reply, usage } = await chatWithProvider(provider, selectedModel, provider.apiKeyBackup, messagesToSend)
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
          reply,
          provider: { id: provider.id, name: provider.name },
          model: selectedModel,
          servedBy: 'Dominic Generative (chave reserva)',
          usage: usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
        })
      } catch (backupErr) {
        return res.status(502).json({ error: `Falha ao contactar ${provider.name}: ${backupErr.message}` })
      }
    }
    return res.status(502).json({ error: `Falha ao contactar ${provider.name}: ${err.message}` })
  }
}