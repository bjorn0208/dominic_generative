import http from 'node:http'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { submitVideo, getVideoStatus } from './lib/agnes.js'
import { generateAppCode, modifyAppCode, suggestImprovements, generateAppName } from './lib/gemini.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, 'data')
const CONFIG_FILE = join(DATA_DIR, 'config.json')

const DEFAULT_CONFIG = {
  providers: [
    {
      id: 'groq',
      name: 'Groq',
      baseUrl: 'https://api.groq.com/openai/v1',
      apiKey: '',
      enabled: true,
      models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.6-27b']
    },
    {
      id: 'google',
      name: 'Google Gemini',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
      apiKey: '',
      enabled: true,
      models: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-2.0-flash-lite-001']
    },
    {
      id: 'nvidia',
      name: 'NVIDIA',
      baseUrl: 'https://integrate.api.nvidia.com/v1',
      apiKey: '',
      enabled: true,
      models: ['meta/llama-3.1-405b-instruct', 'meta/llama-3.1-70b-instruct', 'nvidia/nemotron-3-ultra', 'mistralai/mixtral-8x22b-instruct-v0.1']
    },
    {
      id: 'anthropic',
      name: 'Anthropic',
      baseUrl: 'https://api.anthropic.com/v1',
      apiKey: '',
      enabled: true,
      models: ['claude-3-5-sonnet-latest', 'claude-3-5-haiku-latest', 'claude-3-opus-latest']
    }
  ],
  huggingface: {
    enabled: false,
    apiKey: '',
    datasets: []
  },
  branding: {
    name: 'Dominic Generative',
    tagline: 'Sua própria IA, sob sua marca.'
  }
}

async function loadConfig() {
  try {
    const raw = await readFile(CONFIG_FILE, 'utf-8')
    const config = JSON.parse(raw)
    // Garante campos mínimos mesmo se o config.json for antigo
    if (!config.huggingface) config.huggingface = { enabled: false, apiKey: '', datasets: [] }
    if (!config.branding) config.branding = { name: 'Dominic Generative', tagline: 'Sua própria IA, sob sua marca.' }
    for (const p of config.providers || []) {
      if (!p.baseUrl) p.baseUrl = DEFAULT_CONFIG.providers.find((d) => d.id === p.id)?.baseUrl || ''
    }
    return config
  } catch {
    await mkdir(DATA_DIR, { recursive: true })
    await writeFile(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2))
    return JSON.parse(JSON.stringify(DEFAULT_CONFIG))
  }
}

async function saveConfig(config) {
  await mkdir(DATA_DIR, { recursive: true })
  await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2))
}

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data))
}

async function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
      if (body.length > 20_000_000) {
        reject(new Error('Body too large'))
        req.destroy()
      }
    })
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {})
      } catch {
        reject(new Error('Invalid JSON'))
      }
    })
    req.on('error', reject)
  })
}

function timeoutFetch(url, options = {}, timeoutMs = 60_000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timer))
}

async function fetchHuggingFaceDatasetPreview(dataset, token) {
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
    if (row.data) {
      const parts = Array.isArray(row.data)
        ? row.data.map((part) => (part?.text ? part.text : JSON.stringify(part))).join(' ')
        : JSON.stringify(row.data)
      return `Dataset ${dataset} [linha ${idx + 1}]: ${parts}`
    }
    return `Dataset ${dataset} [linha ${idx + 1}]: ${JSON.stringify(row)}`
  })
}

const HUGGING_FACE_DEFAULT_MODELS = {
  audio: ['openai/whisper-small', 'openai/whisper-large-v2'],
  image: ['Salesforce/blip-image-captioning-base'],
  video: ['openai/whisper-large-v2'],
  code: ['bigcode/starcoder', 'Salesforce/codegen-2B']
}

function serializeHuggingFaceResponse(data) {
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

async function fetchHuggingFaceInference({ type, model, prompt, fileBase64, fileMime }) {
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

async function buildHuggingFaceContext(hfConfig) {
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

async function route(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`)
  const path = url.pathname

  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  // Proxy para o serviço Python (Jarvis local): /api/jarvis/tts, /api/jarvis/brain, /api/jarvis/stt
  if (path.startsWith('/api/jarvis/')) {
    const upstreamPath = path === '/api/jarvis/health' ? '/health' : path.replace('/api/jarvis', '/api')
    await jarvisProxy(req, res, upstreamPath)
    return
  }

  // GET /api/health
  if (req.method === 'GET' && path === '/api/health') {
    sendJson(res, 200, { status: 'ok', service: 'Dominic Generative API', time: new Date().toISOString() })
    return
  }

  // GET /api/config
  if (req.method === 'GET' && path === '/api/config') {
    const config = await loadConfig()
    const safe = JSON.parse(JSON.stringify(config))
    for (const p of safe.providers) {
      if (p.apiKey) p.apiKey = `•••• ${p.apiKey.slice(-4)}`
    }
    if (safe.huggingface.apiKey) {
      safe.huggingface.apiKey = `•••• ${safe.huggingface.apiKey.slice(-4)}`
    }
    sendJson(res, 200, safe)
    return
  }

  // PUT /api/config
  if (req.method === 'PUT' && path === '/api/config') {
    const body = await readBody(req)
    const config = await loadConfig()

    if (body.providers) {
      for (const incoming of body.providers) {
        const existing = config.providers.find((p) => p.id === incoming.id)
        if (!existing) continue
        // Chave vazia ou mascarada => mantém a chave existente
        if (!incoming.apiKey || incoming.apiKey.startsWith('••••')) {
          delete incoming.apiKey
        } else {
          incoming.apiKey = incoming.apiKey.trim()
        }
        Object.assign(existing, incoming)
      }
    }
    if (body.huggingface) {
      const hf = config.huggingface
      if (body.huggingface.apiKey && body.huggingface.apiKey.startsWith('••••')) {
        delete body.huggingface.apiKey
      }
      Object.assign(hf, body.huggingface)
    }
    if (body.branding) {
      Object.assign(config.branding, body.branding)
    }
    await saveConfig(config)
    sendJson(res, 200, { ok: true })
    return
  }

  // GET /api/models
  if (req.method === 'GET' && path === '/api/models') {
    const config = await loadConfig()
    const models = []
    for (const p of config.providers) {
      if (!p.enabled) continue
      for (const m of p.models) {
        models.push({ providerId: p.id, providerName: p.name, model: m })
      }
    }
    sendJson(res, 200, models)
    return
  }

  // GET /api/hf/preview?dataset=org/name
  if (req.method === 'GET' && path === '/api/hf/preview') {
    const config = await loadConfig()
    const dataset = url.searchParams.get('dataset')
    if (!dataset) {
      sendJson(res, 400, { error: 'dataset é obrigatório' })
      return
    }
    const hfConfig = config.huggingface || { enabled: false, apiKey: '', datasets: [] }
    if (!hfConfig.enabled) {
      sendJson(res, 400, { error: 'Hugging Face não está habilitado' })
      return
    }
    try {
      const preview = await fetchHuggingFaceDatasetPreview(dataset, hfConfig.apiKey)
      sendJson(res, 200, { dataset, preview })
    } catch (err) {
      sendJson(res, 502, { error: `Falha ao pré-visualizar dataset: ${err.message || err}` })
    }
    return
  }

  // POST /api/chat - roteador mascarado principal
  if (req.method === 'POST' && path === '/api/chat') {
    const body = await readBody(req)
    const { providerId, model, messages } = body
    if (!providerId || !Array.isArray(messages)) {
      sendJson(res, 400, { error: 'providerId e messages são obrigatórios' })
      return
    }

    const config = await loadConfig()
    const provider = config.providers.find((p) => p.id === providerId)
    if (!provider) {
      sendJson(res, 404, { error: `Provider não encontrado: ${providerId}` })
      return
    }
    if (!provider.enabled) {
      sendJson(res, 400, { error: `Provider ${providerId} está desativado` })
      return
    }

    const selectedModel = model || provider.models[0]
    const effectiveApiKey = body.apiKey || provider.apiKey || ''
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
      let reply
      switch (providerId) {
        case 'ollama': {
          const r = await timeoutFetch(`${provider.baseUrl}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: selectedModel, messages: messagesToSend, stream: false })
          })
          if (!r.ok) {
            const errText = await r.text()
            sendJson(res, 502, { error: `Ollama: ${r.status} ${errText.slice(0, 300)}` })
            return
          }
          const data = await r.json()
          reply = data.message?.content || ''
          break
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
            sendJson(res, 502, { error: `${provider.name}: ${r.status} ${errText.slice(0, 300)}` })
            return
          }
          const data = await r.json()
          reply = data.choices?.[0]?.message?.content || ''
          break
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
            sendJson(res, 502, { error: `${provider.name}: ${r.status} ${errText.slice(0, 300)}` })
            return
          }
          const data = await r.json()
          reply = data.content?.map((c) => c.text).join('') || ''
          break
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
            sendJson(res, 502, { error: `${provider.name}: ${r.status} ${errText.slice(0, 300)}` })
            return
          }
          const data = await r.json()
          reply = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || ''
          break
        }
        default:
          sendJson(res, 400, { error: `Provider não suportado: ${providerId}` })
          return
      }

      sendJson(res, 200, {
        reply,
        provider: { id: provider.id, name: provider.name },
        model: selectedModel,
        servedBy: 'Dominic Generative'
      })
    } catch (err) {
      sendJson(res, 502, { error: `Falha ao contactar ${provider.name}: ${err.message}` })
    }
    return
  }

  // POST /api/hf/infer
  if (req.method === 'POST' && path === '/api/hf/infer') {
    const body = await readBody(req)
    const { type, model, prompt, fileBase64, fileMime } = body
    if (!type) {
      sendJson(res, 400, { error: 'type é obrigatório' })
      return
    }

    try {
      const inference = await fetchHuggingFaceInference({ type, model, prompt, fileBase64, fileMime })
      sendJson(res, 200, inference)
    } catch (err) {
      sendJson(res, 502, { error: err.message || 'Falha na inferência do Hugging Face' })
    }
    return
  }

  // POST /api/hf/image (endpoint para geração de imagem)
  if (req.method === 'POST' && path === '/api/hf/image') {
    const body = await readBody(req)
    const { model, prompt } = body
    if (!prompt) {
      sendJson(res, 400, { error: 'prompt é obrigatório' })
      return
    }

    try {
      const inference = await fetchHuggingFaceInference({
        type: 'image',
        model,
        prompt
      })
      sendJson(res, 200, inference)
    } catch (err) {
      sendJson(res, 502, { error: err.message || 'Falha na geração de imagem' })
    }
    return
  }

  // GET /api/ollama/tags
  if (req.method === 'GET' && path === '/api/ollama/tags') {
    try {
      const r = await timeoutFetch('http://localhost:11434/api/tags')
      if (!r.ok) {
        sendJson(res, 502, { error: `Ollama indisponível (${r.status}). Instale e inicie o Ollama.` })
        return
      }
      const data = await r.json()
      sendJson(res, 200, data)
    } catch (err) {
      sendJson(res, 502, { error: `Ollama indisponível: ${err.message}` })
    }
    return
  }

  // POST /api/agnes (action: submit|status)
  if (path === '/api/agnes') {
    if (req.method === 'POST') {
      const body = await readBody(req)
      const { action, ...params } = body
      if (!action) {
        sendJson(res, 400, { error: 'action é obrigatório (submit|status)' })
        return
      }
      try {
        if (action === 'submit') {
          const { prompt, duration, aspect } = params
          if (!prompt || !prompt.trim()) {
            sendJson(res, 400, { error: 'prompt é obrigatório' })
            return
          }
          const result = await submitVideo({ prompt, duration, aspect })
          sendJson(res, 200, result)
        } else if (action === 'status') {
          const { id } = params
          if (!id) {
            sendJson(res, 400, { error: 'id é obrigatório' })
            return
          }
          const result = await getVideoStatus(id)
          sendJson(res, 200, result)
        } else {
          sendJson(res, 400, { error: `action inválida: ${action}` })
        }
      } catch (err) {
        sendJson(res, 502, { error: err.message || 'Falha na operação' })
      }
      return
    }
    if (req.method === 'GET') {
      const action = url.searchParams.get('action')
      const id = url.searchParams.get('id')
      if (action === 'status') {
        if (!id) {
          sendJson(res, 400, { error: 'id é obrigatório' })
          return
        }
        try {
          const result = await getVideoStatus(id)
          sendJson(res, 200, result)
        } catch (err) {
          sendJson(res, 502, { error: err.message || 'Falha ao consultar status' })
        }
        return
      }
      sendJson(res, 405, { error: 'Método não permitido' })
      return
    }
    sendJson(res, 405, { error: 'Método não permitido' })
    return
  }

  // POST /api/dicebear (generate avatar)
  if (req.method === 'POST' && path === '/api/dicebear') {
    const body = await readBody(req)
    const { seed, style = 'clay', size = 128 } = body
    if (!seed) {
      sendJson(res, 400, { error: 'seed é obrigatório' })
      return
    }

    try {
      const svg = await timeoutFetch(`https://api.dicebear.com/10.x/${style}/svg?seed=${encodeURIComponent(seed)}&size=${size}`)
      if (!svg.ok) {
        sendJson(res, 502, { error: `Dicebear API falhou: ${svg.status}` })
        return
      }
      const svgContent = await svg.text()
      sendJson(res, 200, {
        model: `dicebear/${style}`,
        result: svgContent,
        mimeType: 'image/svg+xml',
        seed,
        style,
        size
      })
    } catch (err) {
      sendJson(res, 502, { error: err.message || 'Falha na geração de avatar' })
    }
    return
  }

  // POST /api/code
  if (req.method === 'POST' && path === '/api/code') {
    const body = await readBody(req)
    const { lang, prompt } = body
    if (!prompt || !prompt.trim()) {
      sendJson(res, 400, { error: 'prompt é obrigatório' })
      return
    }

    const config = await loadConfig()
    const provider =
      config.providers.find((p) => p.id === 'groq' && p.enabled) ||
      config.providers.find((p) => p.enabled)
    if (!provider) {
      sendJson(res, 400, { error: 'Nenhum provedor habilitado' })
      return
    }

    const preferredModel = 'llama-3.3-70b-versatile'
    const selectedModel = provider.models.includes(preferredModel) ? preferredModel : provider.models[0]
    const effectiveApiKey = provider.apiKey || ''
    const langInstructions = {
      html: 'Gere um arquivo HTML único e completo (com <!doctype html>, CSS inline em <style> e JavaScript em <script>), pronto para abrir no navegador.',
      css: 'Gere apenas o CSS, bem organizado e com comentários em seções.',
      js: 'Gere apenas JavaScript puro, sem dependências externas, pronto para rodar em um navegador (use console.log e manipulação de DOM).',
      python: 'Gere um script Python completo e executável, sem dependências externas.',
      sql: 'Gere apenas o SQL (DDL e DML), compatível com PostgreSQL.'
    }

    try {
      const r = await timeoutFetch(`${provider.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${effectiveApiKey}`
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: [
            {
              role: 'system',
              content:
                'Você é um engenheiro de software sênior. Responda APENAS com o código-fonte completo solicitado pelo usuário, sem introdução, sem explicações, sem comentários desnecessários e SEM cercas de markdown (sem ```). O código deve estar pronto para copiar e executar.'
            },
            {
              role: 'user',
              content: `${langInstructions[lang] || ''}\n\nSolicitação do usuário:\n${prompt}`
            }
          ]
        })
      })
      if (!r.ok) {
        const errText = await r.text()
        sendJson(res, 502, { error: `${provider.name}: ${r.status} ${errText.slice(0, 300)}` })
        return
      }
      const data = await r.json()
      sendJson(res, 200, {
        code: data.choices?.[0]?.message?.content || '',
        lang: lang || 'text',
        model: selectedModel,
        provider: { id: provider.id, name: provider.name }
      })
    } catch (err) {
      sendJson(res, 502, { error: `Falha ao contactar ${provider.name}: ${err.message}` })
    }
    return
  }

  // POST /api/app (action: generate|modify|suggest|name)
  if (req.method === 'POST' && path === '/api/app') {
    const body = await readBody(req)
    const { action, ...params } = body
    if (!action) {
      sendJson(res, 400, { error: 'action é obrigatório (generate|modify|suggest|name)' })
      return
    }
    try {
      if (action === 'generate') {
        const { prompt, model } = params
        if (!prompt || !prompt.trim()) {
          sendJson(res, 400, { error: 'prompt é obrigatório' })
          return
        }
        const code = await generateAppCode(prompt, model)
        sendJson(res, 200, { code, provider: 'google' })
      } else if (action === 'modify') {
        const { code, prompt, model } = params
        if (!code || !prompt || !prompt.trim()) {
          sendJson(res, 400, { error: 'code e prompt são obrigatórios' })
          return
        }
        const result = await modifyAppCode({ code, prompt }, model)
        sendJson(res, 200, result)
      } else if (action === 'suggest') {
        const { prompt, model } = params
        if (!prompt || !prompt.trim()) {
          sendJson(res, 400, { error: 'prompt é obrigatório' })
          return
        }
        const result = await suggestImprovements(prompt, model)
        sendJson(res, 200, result)
      } else if (action === 'name') {
        const { prompt, model } = params
        if (!prompt || !prompt.trim()) {
          sendJson(res, 400, { error: 'prompt é obrigatório' })
          return
        }
        const name = await generateAppName(prompt, model)
        sendJson(res, 200, { name })
      } else {
        sendJson(res, 400, { error: `action inválida: ${action}` })
      }
    } catch (err) {
      sendJson(res, 502, { error: err.message || 'Falha na operação' })
    }
    return
  }

  sendJson(res, 404, { error: 'Rota não encontrada' })
}

const server = http.createServer(async (req, res) => {
  try {
    await route(req, res)
  } catch (err) {
    if (!res.headersSent) {
      sendJson(res, 500, { error: `Erro interno: ${err.message}` })
    } else {
      res.end()
    }
  }
})

const PORT = 5174

const JARVIS_SERVICE_URL = process.env.JARVIS_SERVICE_URL || 'http://127.0.0.1:8765'

async function jarvisProxy(req, res, path) {
  try {
    const body = await readBody(req)
    const hasBody = Object.keys(body).length > 0
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 6000)
    const upstream = await fetch(`${JARVIS_SERVICE_URL}${path}`, {
      method: req.method,
      headers: { 'Content-Type': 'application/json' },
      body: hasBody ? JSON.stringify(body) : undefined,
      signal: controller.signal
    })
    clearTimeout(timer)
    const data = await upstream.arrayBuffer()
    const contentType = upstream.headers.get('content-type') || 'application/json'
    res.writeHead(upstream.status, {
      'Content-Type': contentType,
      'Content-Length': data.byteLength
    })
    res.end(Buffer.from(data))
  } catch (err) {
    res.writeHead(503, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'jarvis-offline', detail: err.message }))
  }
}

const DOMINIC_SYSTEM_PROMPT = `Você é o Dominic, 28 anos. Amigo inteligente, criativo e bem humorado. Fala como no WhatsApp.

REGRAS ABSOLUTAS:
- Respostas curtas. 5 palavras > 20 palavras.
- Nunca textão. Nunca introdução/conclusão. Nunca "fico feliz em ajudar".
- Confirmações naturais: "Fechou.", "Show.", "Aham.", "Tamo junto.", "Bora.", "Pode deixar."
- No máximo 1 emoji por mensagem (😂 😅 👍 🔥 👊).
- Abreviações só de vez em quando: vc, pq, tb, blz, kk.
- Sem linguagem corporativa. Sem explicar o que não perguntaram.
- Se histórico ficar grande: "Ei kk... histórico grandão 😅" (uma vez só).

OBJETIVO: Parecer amigo no WhatsApp. Natural. Rápido. Divertido.`
server.listen(PORT, () => {
  console.log(`Dominic Generative API rodando em http://localhost:${PORT}`)
})
