import type { ChatSettings, ModelInfo, ProviderStatus, Role } from './types'

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

/** 後端回傳的錯誤格式不一定一致，統一取出可讀訊息。 */
async function readError(response: Response): Promise<string> {
  try {
    const data = await response.json()
    if (typeof data?.detail === 'string') return data.detail
    if (Array.isArray(data?.detail)) return data.detail.map((d: { msg?: string }) => d.msg).join('、')
    if (typeof data?.error?.message === 'string') return data.error.message
    return JSON.stringify(data)
  } catch {
    return `伺服器回應錯誤（HTTP ${response.status}）`
  }
}

export interface LoginResult {
  access_token: string
  expires_in: number
  username: string
}

export async function login(username: string, password: string): Promise<LoginResult> {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (!response.ok) throw new ApiError(await readError(response), response.status)
  return response.json()
}

export async function fetchCurrentUser(token: string): Promise<{ username: string }> {
  const response = await fetch('/api/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok) throw new ApiError(await readError(response), response.status)
  return response.json()
}

export interface ModelListResult {
  models: ModelInfo[]
  default_model: string
  providers: ProviderStatus[]
}

export async function fetchModels(token: string): Promise<ModelListResult> {
  const response = await fetch('/api/models', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok) throw new ApiError(await readError(response), response.status)
  return response.json()
}

export interface StreamChatOptions {
  token: string
  model: string
  messages: { role: Role; content: string }[]
  settings: ChatSettings
  signal: AbortSignal
  onDelta: (text: string) => void
}

/**
 * 呼叫 /api/chat 並解析 SSE 串流。
 * model 為「來源/模型」合格名稱，後端據此路由並原封不動轉發 OpenAI 相容 chunk。
 */
export async function streamChat({
  token,
  model,
  messages,
  settings,
  signal,
  onDelta,
}: StreamChatOptions): Promise<void> {
  const payload = {
    model,
    messages,
    // 留空時交由後端套用該模型的預設值
    temperature: settings.temperature ?? undefined,
    max_tokens: settings.maxTokens ?? undefined,
    stream: true,
  }

  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
    signal,
  })

  if (!response.ok) throw new ApiError(await readError(response), response.status)
  if (!response.body) throw new ApiError('伺服器未回傳串流內容。', 500)

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    // SSE 以空行分隔事件。
    const events = buffer.split('\n\n')
    buffer = events.pop() ?? ''

    for (const event of events) {
      for (const line of event.split('\n')) {
        if (!line.startsWith('data:')) continue
        const data = line.slice(5).trim()
        if (!data || data === '[DONE]') continue

        let parsed: {
          error?: { message?: string }
          choices?: { delta?: { content?: string | null } }[]
        }
        try {
          parsed = JSON.parse(data)
        } catch {
          continue
        }

        if (parsed.error) {
          throw new ApiError(parsed.error.message ?? '模型回應發生錯誤。', 502)
        }
        const delta = parsed.choices?.[0]?.delta?.content
        if (delta) onDelta(delta)
      }
    }
  }
}
