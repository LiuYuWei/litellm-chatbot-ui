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
  /** 此模型的預設 temperature（模型 > 來源 > 全域） */
  temperature: number
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
  /** null 代表跟隨目前模型的預設值；數字代表使用者自行覆寫 */
  temperature: number | null
  maxTokens: number | null
}

export interface AuthSession {
  token: string
  username: string
  /** token 到期時間（毫秒） */
  expiresAt: number
}
