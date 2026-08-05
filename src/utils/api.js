const BASE = '/api'

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error || `Erro ${res.status}`)
  }
  return data
}

export function fetchConfig() {
  return request('/config')
}

export function saveConfig(config) {
  return request('/config', { method: 'PUT', body: JSON.stringify(config) })
}

export function fetchModels() {
  return request('/models')
}

export function fetchOllamaTags() {
  return request('/ollama/tags')
}

export async function sendChat({ providerId, model, messages }) {
  const data = await request('/chat', {
    method: 'POST',
    body: JSON.stringify({ providerId, model, messages })
  })
  return data
}

export async function fetchHuggingFaceInference(payload) {
  return request('/hf/infer', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

export async function testConnection(providerId) {
  try {
    const data = await sendChat({
      providerId,
      model: null,
      messages: [{ role: 'user', content: 'Responda apenas: OK' }]
    })
    return { ok: true, name: data.provider?.name || providerId, model: data.model, message: data.reply?.slice(0, 80) }
  } catch (err) {
    return { ok: false, name: providerId, message: err.message }
  }
}

export function fetchHuggingFacePreview(dataset) {
  return request(`/hf/preview?dataset=${encodeURIComponent(dataset)}`)
}

export function fetchUsage(period = '7d') {
  return request(`/usage?period=${period}`)
}

export async function generateImage({ model, prompt }) {
  return request('/hf/image', {
    method: 'POST',
    body: JSON.stringify({ model, prompt })
  })
}

export async function submitAgnesVideo({ prompt, duration, aspect }) {
  return request('/agnes', {
    method: 'POST',
    body: JSON.stringify({ action: 'submit', prompt, duration, aspect })
  })
}

export function getAgnesVideoStatus(id) {
  return request(`/agnes?action=status&id=${encodeURIComponent(id)}`)
}

export async function generateCode({ lang, prompt }) {
  return request('/code', {
    method: 'POST',
    body: JSON.stringify({ lang, prompt })
  })
}

export async function generateApp({ prompt }) {
  return request('/app', {
    method: 'POST',
    body: JSON.stringify({ action: 'generate', prompt })
  })
}

export async function modifyApp({ code, prompt }) {
  return request('/app', {
    method: 'POST',
    body: JSON.stringify({ action: 'modify', code, prompt })
  })
}

export async function suggestAppImprovements({ prompt }) {
  return request('/app', {
    method: 'POST',
    body: JSON.stringify({ action: 'suggest', prompt })
  })
}

export async function generateAppName({ prompt }) {
  return request('/app', {
    method: 'POST',
    body: JSON.stringify({ action: 'name', prompt })
  })
}

export async function generateDicebearAvatar({ seed, style, size }) {
  return request('/dicebear', {
    method: 'POST',
    body: JSON.stringify({ seed, style, size })
  })
}
