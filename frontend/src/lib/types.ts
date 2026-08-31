export type Role = 'system' | 'user' | 'assistant'

export interface ChatMessage {
  id: string
  role: Role
  content: string
  /** 訊息建立時間（毫秒） */
  createdAt: number
  /** 產生此則回覆所使用的模型 */
  model?: string
  /** 標記此則訊息為錯誤訊息 */
  error?: boolean
}

export interface Conversation {
  id: string
  title: string
  messages: ChatMessage[]
  model: string
  createdAt: number
  updatedAt: number
}

export interface ModelInfo {
  /** 合格名稱：來源 id + / + 原生模型名稱 */
  id: string
  /** 該來源上的原生模型名稱 */
  model: string
  provider: string
  provider_label: string
  owned_by?: string | null
}

export interface ProviderStatus {
  id: string
  label: string
  base_url: string
  reachable: boolean
  model_count: number
  error?: string | null
}

export interface ChatSettings {
  systemPrompt: string
  temperature: number
  maxTokens: number | null
}

export interface AuthSession {
  token: string
  username: string
  /** token 到期時間（毫秒） */
  expiresAt: number
}
