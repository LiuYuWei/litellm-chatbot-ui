import type { AuthSession, ChatSettings, Conversation } from './types'

const KEYS = {
  session: 'litellm-ui.session',
  conversations: 'litellm-ui.conversations',
  settings: 'litellm-ui.settings',
  theme: 'litellm-ui.theme',
} as const

export const DEFAULT_SETTINGS: ChatSettings = {
  systemPrompt: '你是一位樂於助人的 AI 助理，請用繁體中文清楚地回答問題。',
  temperature: 0.7,
  maxTokens: null,
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // 瀏覽器停用儲存空間時忽略，不影響對話進行。
  }
}

export function loadSession(): AuthSession | null {
  const session = read<AuthSession | null>(KEYS.session, null)
  if (!session?.token) return null
  if (session.expiresAt && session.expiresAt < Date.now()) {
    clearSession()
    return null
  }
  return session
}

export function saveSession(session: AuthSession): void {
  write(KEYS.session, session)
}

export function clearSession(): void {
  localStorage.removeItem(KEYS.session)
}

export function loadConversations(): Conversation[] {
  const items = read<Conversation[]>(KEYS.conversations, [])
  return Array.isArray(items) ? items.filter((c) => c?.id && Array.isArray(c.messages)) : []
}

export function saveConversations(conversations: Conversation[]): void {
  write(KEYS.conversations, conversations)
}

export function loadSettings(): ChatSettings {
  return { ...DEFAULT_SETTINGS, ...read<Partial<ChatSettings>>(KEYS.settings, {}) }
}

export function saveSettings(settings: ChatSettings): void {
  write(KEYS.settings, settings)
}

export type Theme = 'light' | 'dark'

export function loadTheme(): Theme {
  const stored = localStorage.getItem(KEYS.theme)
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function saveTheme(theme: Theme): void {
  localStorage.setItem(KEYS.theme, theme)
}
