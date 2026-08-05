import { loadConfig } from './config.js'
import { timeoutFetch } from './hf.js'

export const APP_SYSTEM_INSTRUCTION = `You are Dominic, an elite full-stack engineer and product designer.
Create a single HTML file that implements the user's request.
You MUST use this exact template structure:

<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dominic Generated App</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
    <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@400;600;800&display=swap" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0" rel="stylesheet" />
    <style>
        :root { --primary: #4b2bee; }
        body { font-family: 'Inter', sans-serif; }
        .font-display { font-family: 'Outfit', sans-serif; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        .glass { background: rgba(255, 255, 255, 0.7); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.2); }
        .dark-glass { background: rgba(15, 15, 20, 0.8); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.05); }
        .bento-card { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
        .bento-card:hover { transform: translateY(-2px); box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1); }
    </style>
</head>
<body class="bg-[#f8fafc] text-slate-900 antialiased min-h-screen">
    <div id="root"></div>
    <script type="text/babel">
        const { useState, useEffect, useMemo, useCallback, useRef } = React;

        function App() {
            return (
                <div className="p-8">
                    <h1 className="font-display text-4xl font-extrabold mb-4">Bem-vindo ao Dominic</h1>
                    <p className="text-slate-500">Comece a construir algo incrível.</p>
                </div>
            );
        }

        const root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(<App />);
    </script>
</body>
</html>

CRITICAL DESIGN RULES:
1. LUXURY UI: Every component must feel premium. Use generous white space, perfect alignment, and subtle transitions.
2. BENTO GRID: If the app has multiple data points, use a "Bento Box" layout with varying card sizes, rounded-3xl corners, and subtle borders.
3. GLASSMORPHISM: Use the .glass class for overlays, modals, and sidebars to create depth.
4. TYPOGRAPHY: Use 'Outfit' for headings (font-display) and 'Inter' for body text.
5. ICONS: ALWAYS use Material Symbols Outlined with the classes: "material-symbols-outlined notranslate".
6. COLORS: Default to indigo/violet/slate, but adapt to user brand requests if specified.
7. MOCK DATA: Never show "No data". Always populate with 5-10 realistic mock items.
8. RESPONSIVENESS: Ensure it looks beautiful on mobile (single column) and desktop (grid).

Return ONLY the raw HTML code. No markdown, no explanations.`

const MODIFY_SYSTEM_INSTRUCTION = `You are Dominic, an elite full-stack engineer and product designer.
You are given an existing HTML file containing a React application.
Modify the code based on the user's request.

CRITICAL RULES:
1. Maintain the professional, modern, and production-ready design.
2. Use Tailwind CSS and Material Symbols Outlined icons.
3. You MUST return a valid JSON object with exactly two keys:
   "code": The COMPLETE modified raw HTML code (do not omit parts).
   "summary": A short summary in Portuguese listing the changes made (use bullet points).
4. Do not include any other text or markdown formatting outside the JSON object.
5. Return the JSON object directly.`

const SUGGEST_SYSTEM =
  'Você é o Dominic, um arquiteto de soluções e designer de produto.\nBaseado no prompt inicial do usuário, sugira 3 melhorias ou recursos adicionais que tornariam este aplicativo "nível unicórnio".\nAs sugestões devem ser curtas, diretas e focadas em valor para o usuário final.\nRetorne um objeto JSON com uma chave "suggestions" contendo um array de strings.'

const NAME_SYSTEM =
  'Baseado neste prompt de aplicativo, gere um nome curto e criativo (máximo 3 a 4 palavras) para o app. Retorne APENAS o nome, sem aspas ou pontuação extra.'

const ENHANCE_SYSTEM =
  'Melhore o seguinte prompt de criação de aplicativo. O usuário digitou uma ideia básica e você deve transformá-la em um prompt detalhado, profissional e focado em UX/UI, especificando recursos, layout, cores e interações desejadas. Retorne APENAS o prompt melhorado, sem introduções.'

const CONSULT_SYSTEM =
  "Você é o Dominic, um assistente de IA especialista em desenvolvimento web.\nO usuário está fazendo uma pergunta sobre o código atual do aplicativo dele.\nResponda de forma amigável, concisa e útil. Dê dicas e explique como as coisas funcionam.\nNÃO retorne o código completo modificado, apenas responda à pergunta."

function extractJson(text) {
  if (!text) return null
  const cleaned = text
    .trim()
    .replace(/^```json\s*\n?/, '')
    .replace(/^```\s*\n?/, '')
    .replace(/\n?```\s*$/, '')
  try {
    return JSON.parse(cleaned)
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (match) {
      try {
        return JSON.parse(match[0])
      } catch {
        return null
      }
    }
    return null
  }
}

async function resolveGoogle({ model }) {
  const config = await loadConfig()
  const provider = config.providers.find((p) => p.id === 'google' && p.enabled)
  if (!provider?.apiKey) {
    throw new Error('Chave Google Gemini não configurada. Configure na aba Fornecedores (provider Google).')
  }
  const picked =
    model ||
    provider.models.find((m) => m.includes('3-flash')) ||
    provider.models.find((m) => m.includes('2.5-flash')) ||
    provider.models[0] ||
    'gemini-2.5-flash'
  return { provider, model: picked }
}

export async function callGemini({ parts, model, responseMimeType, maxRetries = 3 }) {
  const { provider, model: pickedModel } = await resolveGoogle({ model })
  const url = `${provider.baseUrl}/models/${encodeURIComponent(pickedModel)}:generateContent?key=${encodeURIComponent(provider.apiKey)}`
  const payload = {
    contents: [{ role: 'user', parts: parts.map((p) => (typeof p === 'string' ? { text: p } : p)) }]
  }
  if (responseMimeType) payload.generationConfig = { responseMimeType }

  let lastError
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await timeoutFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }, 120_000)
      if (!res.ok) {
        const errText = await res.text()
        const isQuota = res.status === 429 || errText.includes('RESOURCE_EXHAUSTED') || errText.toLowerCase().includes('quota')
        const isUnavailable = res.status === 503 || errText.includes('UNAVAILABLE') || errText.includes('high demand')
        if ((isQuota || isUnavailable) && attempt < maxRetries) {
          const waitTime = (isQuota ? 15000 : 2000) * (attempt + 1)
          await new Promise((r) => setTimeout(r, waitTime))
          continue
        }
        throw new Error(`Gemini: ${res.status} ${errText.slice(0, 300)}`)
      }
      const data = await res.json()
      return data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || ''
    } catch (err) {
      lastError = err
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)))
      }
    }
  }
  throw lastError || new Error('Falha ao chamar o Gemini')
}

export async function generateAppCode(prompt, model) {
  const text = await callGemini({ model, parts: [APP_SYSTEM_INSTRUCTION, prompt] })
  return text.replace(/^```html\s*\n?/, '').replace(/\n?```$/, '').trim()
}

export async function modifyAppCode({ code, prompt }, model) {
  const text = await callGemini({
    model,
    responseMimeType: 'application/json',
    parts: [MODIFY_SYSTEM_INSTRUCTION, `Current Code:\n${code}\n\nUser Request:\n${prompt}`]
  })
  const parsed = extractJson(text)
  if (parsed && parsed.code) {
    return { code: parsed.code, summary: parsed.summary || '', provider: 'google' }
  }
  return { code: text, summary: '', provider: 'google' }
}

export async function suggestImprovements(prompt, model) {
  const text = await callGemini({ model, responseMimeType: 'application/json', parts: [SUGGEST_SYSTEM, `Prompt: ${prompt}`] })
  const parsed = extractJson(text)
  const suggestions = parsed?.suggestions || []
  if (!Array.isArray(suggestions)) {
    return { suggestions: ['Adicionar modo offline', 'Notificações push', 'Integração com calendário'] }
  }
  return { suggestions: suggestions.map(String).filter(Boolean).slice(0, 3) }
}

export async function generateAppName(prompt, model) {
  const text = await callGemini({ model, parts: [NAME_SYSTEM, `Prompt: ${prompt}`] })
  const name = text.replace(/[.,!?"“”']/g, '').trim()
  return name || 'Meu App'
}

export async function enhancePrompt(prompt, model) {
  const text = await callGemini({ model, parts: [ENHANCE_SYSTEM, `Prompt original: ${prompt}`] })
  return text.trim() || prompt
}

export async function consultApp({ code, question }, model) {
  const text = await callGemini({ model, parts: [CONSULT_SYSTEM, `Código atual:\n\`\`\`tsx\n${code}\n\`\`\`\n\nPergunta do usuário: ${question}`] })
  return text || 'Não consegui analisar sua pergunta.'
}