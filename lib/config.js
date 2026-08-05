import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { query, getPool } from './db.js'

const DATA_DIR = join(process.cwd(), 'data')
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

export async function loadConfig() {
  const dbConfig = await loadConfigFromDb()
  if (dbConfig) return dbConfig

  let config
  try {
    const raw = await readFile(CONFIG_FILE, 'utf-8')
    config = JSON.parse(raw)
  } catch {
    config = JSON.parse(JSON.stringify(DEFAULT_CONFIG))
    await mkdir(DATA_DIR, { recursive: true })
    await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2))
  }
  if (!config.huggingface) config.huggingface = { enabled: false, apiKey: '', datasets: [] }
  if (!config.branding) config.branding = { name: 'Dominic Generative', tagline: 'Sua própria IA, sob sua marca.' }
  for (const p of config.providers || []) {
    if (!p.baseUrl) {
      const def = DEFAULT_CONFIG.providers.find((d) => d.id === p.id)
      if (def) p.baseUrl = def.baseUrl
    }
  }
  // Variáveis de ambiente têm prioridade sobre o config.json (seguro para produção)
  if (process.env.HF_TOKEN) {
    config.huggingface.apiKey = process.env.HF_TOKEN
    config.huggingface.enabled = true
  }
  for (const envKey of Object.keys(process.env)) {
    const match = envKey.match(/^API_KEY_([A-Z0-9_]+)$/)
    if (match) {
      const provider = config.providers.find((p) => p.id === match[1].toLowerCase())
      if (provider) provider.apiKey = process.env[envKey]
    }
  }
  return config
}

async function loadConfigFromDb() {
  if (!process.env.DATABASE_URL) return null
  try {
    const config = {
      providers: [],
      huggingface: { enabled: false, apiKey: '', datasets: [] },
      branding: { name: 'Dominic Generative', tagline: 'Sua própria IA, sob sua marca.' }
    }

    const [providersRes, configsRes, datasetsRes] = await Promise.all([
      query('SELECT * FROM providers ORDER BY id'),
      query("SELECT key, value FROM app_config WHERE key IN ('branding','huggingface')"),
      query('SELECT dataset_id FROM hf_datasets WHERE enabled = true')
    ])

    for (const row of providersRes.rows) {
      const modelsRes = await query('SELECT model FROM provider_models WHERE provider_id = $1 ORDER BY model', [row.id])
      const def = DEFAULT_CONFIG.providers.find((d) => d.id === row.id)
      config.providers.push({
        id: row.id,
        name: row.name,
        baseUrl: row.base_url || def?.baseUrl || '',
        apiKey: row.api_key || '',
        enabled: row.enabled,
        models: modelsRes.rows.map((m) => m.model)
      })
    }

    for (const row of configsRes.rows) {
      if (row.key === 'branding') config.branding = { ...config.branding, ...row.value }
      if (row.key === 'huggingface') config.huggingface = { ...config.huggingface, ...row.value }
    }
    config.huggingface.datasets = datasetsRes.rows.map((r) => r.dataset_id)

    // Variáveis de ambiente têm prioridade (seguro para produção)
    if (process.env.HF_TOKEN) {
      config.huggingface.apiKey = process.env.HF_TOKEN
      config.huggingface.enabled = true
    }
    for (const envKey of Object.keys(process.env)) {
      const match = envKey.match(/^API_KEY_([A-Z0-9_]+)$/)
      if (match) {
        const provider = config.providers.find((p) => p.id === match[1].toLowerCase())
        if (provider) provider.apiKey = process.env[envKey]
      }
    }
    return config
  } catch (err) {
    console.error('Falha ao carregar config do banco:', err.message)
    return null
  }
}

export async function saveConfig(config) {
  if (process.env.DATABASE_URL) {
    await saveConfigToDb(config)
    return
  }
  await mkdir(DATA_DIR, { recursive: true })
  await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2))
}

async function saveConfigToDb(config) {
  const client = await getPool().connect()
  try {
    await client.query('BEGIN')
    await client.query('DELETE FROM provider_models')
    await client.query('DELETE FROM providers')
    for (const p of config.providers) {
      const def = DEFAULT_CONFIG.providers.find((d) => d.id === p.id)
      await client.query(
        'INSERT INTO providers (id, name, base_url, api_key, enabled) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO UPDATE SET name=$2, base_url=$3, api_key=$4, enabled=$5',
        [p.id, p.name, p.baseUrl || def?.baseUrl || '', p.apiKey || '', p.enabled ?? true]
      )
      for (const m of p.models || []) {
        await client.query('INSERT INTO provider_models (provider_id, model) VALUES ($1,$2) ON CONFLICT (provider_id, model) DO NOTHING', [p.id, m])
      }
    }
    if (config.branding) {
      await client.query(
        'INSERT INTO app_config (key, value, updated_at) VALUES ($1,$2,now()) ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=now()',
        ['branding', config.branding]
      )
    }
    if (config.huggingface) {
      await client.query(
        'INSERT INTO app_config (key, value, updated_at) VALUES ($1,$2,now()) ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=now()',
        ['huggingface', config.huggingface]
      )
      await client.query('DELETE FROM hf_datasets')
      for (const ds of config.huggingface.datasets || []) {
        await client.query('INSERT INTO hf_datasets (dataset_id) VALUES ($1) ON CONFLICT (dataset_id) DO NOTHING', [ds])
      }
    }
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}