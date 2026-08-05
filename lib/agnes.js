import { loadConfig } from './config.js'
import { timeoutFetch } from './hf.js'

export const AGNES_BASE = 'https://apihub.agnes-ai.com'

const DURATION_FRAMES = {
  5: [121, 24],
  10: [241, 24],
  15: [361, 24],
  18: [409, 24],
  20: [409, 24]
}

export const ASPECT_PRESETS = {
  '16:9': { width: 1152, height: 768, label: 'Horizontal 16:9' },
  '9:16': { width: 768, height: 1152, label: 'Vertical 9:16 (Shorts/TikTok)' },
  '1:1': { width: 1024, height: 1024, label: 'Quadrado 1:1' }
}

export async function getAgnesApiKey() {
  if (process.env.AGNES_API_KEY) return process.env.AGNES_API_KEY.trim()
  const config = await loadConfig()
  return config.agnes?.apiKey || ''
}

function getFrameConfig(duration, width, height) {
  const preset = DURATION_FRAMES[duration] || DURATION_FRAMES[5]
  const pixels = width * height
  let maxFrames = 961
  if (pixels > 854 * 480) maxFrames = 409
  if (pixels > 1280 * 720) maxFrames = 169
  if (preset[0] <= maxFrames) return preset
  return [maxFrames, preset[1]]
}

export async function submitVideo({ prompt, duration = 5, aspect = '16:9' }) {
  const apiKey = await getAgnesApiKey()
  if (!apiKey) {
    throw new Error('Chave Agnes ausente. Configure AGNES_API_KEY no Vercel.')
  }

  const preset = ASPECT_PRESETS[aspect] || ASPECT_PRESETS['16:9']
  const [numFrames, frameRate] = getFrameConfig(duration, preset.width, preset.height)

  const res = await timeoutFetch(`${AGNES_BASE}/v1/videos`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'agnes-video-v2.0',
      prompt,
      width: preset.width,
      height: preset.height,
      num_frames: numFrames,
      frame_rate: frameRate
    })
  }, 90_000)

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Agnes: ${res.status} ${errText.slice(0, 300)}`)
  }
  const data = await res.json()
  const videoId = data.video_id || data.task_id || data.id
  if (!videoId) {
    throw new Error('Agnes não retornou video_id')
  }
  return { videoId, ...data }
}

export async function getVideoStatus(videoId) {
  const apiKey = await getAgnesApiKey()
  if (!apiKey) {
    throw new Error('Chave Agnes ausente. Configure AGNES_API_KEY no Vercel.')
  }

  const res = await timeoutFetch(
    `${AGNES_BASE}/agnesapi?video_id=${encodeURIComponent(videoId)}`,
    { headers: { Authorization: `Bearer ${apiKey}` } },
    30_000
  )
  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Agnes status: ${res.status} ${errText.slice(0, 200)}`)
  }
  const data = await res.json()
  const videoUrl =
    data.remixed_from_video_id ||
    data.video_url ||
    data.url ||
    data.data?.video_url ||
    data.data?.url ||
    null
  return {
    status: data.status || 'unknown',
    progress: Number(data.progress) || 0,
    videoUrl,
    error: data.error || (data.status === 'failed' ? 'Geração de vídeo falhou' : null)
  }
}
