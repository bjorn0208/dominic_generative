import { loadConfig } from './config.js'

const HUGGING_FACE_DEFAULT_MODELS = {
  audio: ['openai/whisper-small', 'openai/whisper-large-v2'],
  image: ['Salesforce/blip-image-captioning-base'],
  video: ['openai/whisper-large-v2'],
  code: ['bigcode/starcoder', 'Salesforce/codegen-2B']
}

export function timeoutFetch(url, options = {}, timeoutMs = 60_000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timer))
}

export async function fetchHuggingFaceDatasetPreview(dataset, token) {
  const url = `https://datasets-server.huggingface.co/rows?dataset=${encodeURIComponent(dataset)}&config=default&split=train&offset=0&length=3`
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`

  const r = await timeoutFetch(url, { headers })
  if (!r.ok) {
    return [`Falha ao carregar dataset ${dataset}: ${r.status}`]
  }
  const data = await r.json()
  const rows = Array.isArray(data.rows) ? data.rows : []
  return rows.slice(0, 3).map((row, idx) => {
    let text = ''
    if (row.data) {
      text = Array.isArray(row.data)
        ? row.data.map((part) => (part?.text ? part.text : JSON.stringify(part))).join(' ')
        : JSON.stringify(row.data)
    } else {
      text = JSON.stringify(row)
    }
    if (text.length > 800) text = text.slice(0, 800) + '…'
    return `Dataset ${dataset} [linha ${idx + 1}]: ${text}`
  })
}

export async function buildHuggingFaceContext(hfConfig) {
  if (!hfConfig?.enabled || !Array.isArray(hfConfig.datasets) || hfConfig.datasets.length === 0) {
    return []
  }

  const contexts = []
  for (const dataset of hfConfig.datasets.slice(0, 3)) {
    try {
      const preview = await fetchHuggingFaceDatasetPreview(dataset, hfConfig.apiKey)
      contexts.push(...preview)
    } catch (err) {
      contexts.push(`Falha ao carregar dataset ${dataset}: ${err.message || err}`)
    }
  }
  return contexts
}

export function serializeHuggingFaceResponse(data) {
  if (!data) return ''
  if (typeof data === 'string') return data
  if (Array.isArray(data)) {
    return data.map((item) => (typeof item === 'string' ? item : JSON.stringify(item))).join('\n')
  }
  if (data.generated_text) return data.generated_text
  if (data.text) return data.text
  if (data.error) return data.error
  return JSON.stringify(data, null, 2)
}

export async function fetchHuggingFaceInference({ type, model, prompt, fileBase64, fileMime }) {
  const config = await loadConfig()
  const hfConfig = config.huggingface || { enabled: false, apiKey: '' }
  if (!hfConfig.enabled || !hfConfig.apiKey) {
    throw new Error('Hugging Face não está habilitado ou sem chave')
  }
  const inferenceModel = model || HUGGING_FACE_DEFAULT_MODELS[type]?.[0]
  if (!inferenceModel) {
    throw new Error(`Tipo inválido ou modelo ausente: ${type}`)
  }

  const url = `https://api-inference.huggingface.co/models/${encodeURIComponent(inferenceModel)}`
  const headers = { Authorization: `Bearer ${hfConfig.apiKey}` }
  const options = { method: 'POST', headers }

  if (type === 'code') {
    headers['Content-Type'] = 'application/json'
    options.body = JSON.stringify({ inputs: prompt || '' })
  } else {
    if (!fileBase64 || !fileMime) {
      throw new Error('Arquivo e tipo MIME são obrigatórios para este tipo')
    }
    const buffer = Buffer.from(fileBase64, 'base64')
    options.body = buffer
    headers['Content-Type'] = fileMime
  }

  const res = await timeoutFetch(url, options)
  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Hugging Face inferência falhou: ${res.status} ${errText}`)
  }
  const data = await res.json().catch(async () => {
    const text = await res.text()
    return text
  })
  return { model: inferenceModel, type, result: serializeHuggingFaceResponse(data) }
}

export async function generateImage({ model, prompt }) {
  const config = await loadConfig()
  const hfConfig = config.huggingface || { enabled: false, apiKey: '' }
  if (!hfConfig.enabled || !hfConfig.apiKey) {
    throw new Error('Hugging Face não está habilitado ou sem chave')
  }
  const imageModel = model || 'stabilityai/stable-diffusion-3-medium-diffusers'
  const url = `https://router.huggingface.co/hf-inference/models/${encodeURIComponent(imageModel)}`
  const res = await timeoutFetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${hfConfig.apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'image/png'
    },
    body: JSON.stringify({ inputs: prompt || '' })
  })
  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Geração de imagem falhou: ${res.status} ${errText.slice(0, 200)}`)
  }
  const contentType = res.headers.get('content-type') || 'image/png'
  const buffer = Buffer.from(await res.arrayBuffer())
  return {
    model: imageModel,
    type: 'image-gen',
    mimeType: contentType,
    result: buffer.toString('base64')
  }
}

export async function chatWithProvider(provider, selectedModel, effectiveApiKey, messagesToSend) {
  switch (provider.id) {
    case 'ollama': {
      const r = await timeoutFetch(`${provider.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: selectedModel, messages: messagesToSend, stream: false })
      })
      if (!r.ok) {
        const errText = await r.text()
        throw new Error(`Ollama: ${r.status} ${errText.slice(0, 300)}`)
      }
      const data = await r.json()
      return {
        reply: data.message?.content || '',
        usage: {
          prompt_tokens: data.prompt_eval_count ?? 0,
          completion_tokens: data.eval_count ?? 0,
          total_tokens: (data.prompt_eval_count ?? 0) + (data.eval_count ?? 0)
        }
      }
    }
    case 'openai':
    case 'groq': {
      const r = await timeoutFetch(`${provider.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${effectiveApiKey}`
        },
        body: JSON.stringify({ model: selectedModel, messages: messagesToSend })
      })
      if (!r.ok) {
        const errText = await r.text()
        throw new Error(`${provider.name}: ${r.status} ${errText.slice(0, 300)}`)
      }
      const data = await r.json()
      return {
        reply: data.choices?.[0]?.message?.content || '',
        usage: data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
      }
    }
    case 'anthropic': {
      const systemMessages = messagesToSend.filter((m) => m.role === 'system')
      const userMessages = messagesToSend.filter((m) => m.role !== 'system')
      const r = await timeoutFetch(`${provider.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': effectiveApiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: selectedModel,
          max_tokens: 4096,
          system: systemMessages.map((m) => m.content).join('\n'),
          messages: userMessages
        })
      })
      if (!r.ok) {
        const errText = await r.text()
        throw new Error(`${provider.name}: ${r.status} ${errText.slice(0, 300)}`)
      }
      const data = await r.json()
      const u = data.usage || {}
      return {
        reply: data.content?.map((c) => c.text).join('') || '',
        usage: {
          prompt_tokens: u.input_tokens ?? 0,
          completion_tokens: u.output_tokens ?? 0,
          total_tokens: (u.input_tokens ?? 0) + (u.output_tokens ?? 0)
        }
      }
    }
    case 'google': {
      const systemMessages = messagesToSend.filter((m) => m.role === 'system')
      const userMessages = messagesToSend.filter((m) => m.role !== 'system')
      const contents = userMessages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }))
      const payload = {
        contents,
        systemInstruction: systemMessages.length
          ? { parts: [{ text: systemMessages.map((m) => m.content).join('\n') }] }
          : undefined
      }
      const r = await timeoutFetch(
        `${provider.baseUrl}/models/${selectedModel}:generateContent?key=${encodeURIComponent(effectiveApiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }
      )
      if (!r.ok) {
        const errText = await r.text()
        throw new Error(`${provider.name}: ${r.status} ${errText.slice(0, 300)}`)
      }
      const data = await r.json()
      const u = data.usageMetadata || {}
      return {
        reply: data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '',
        usage: {
          prompt_tokens: u.promptTokenCount ?? 0,
          completion_tokens: u.candidatesTokenCount ?? 0,
          total_tokens: u.totalTokenCount ?? ((u.promptTokenCount ?? 0) + (u.candidatesTokenCount ?? 0))
        }
      }
    }
    default:
      throw new Error(`Provider não suportado: ${provider.id}`)
  }
}