import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, Menu, Moon, Settings2, Sun, TriangleAlert, X } from 'lucide-react'
import Composer from '../components/Composer'
import ConfirmDialog from '../components/ConfirmDialog'
import MessageList from '../components/MessageList'
import ModelSelect from '../components/ModelSelect'
import SettingsPanel from '../components/SettingsPanel'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../context/AuthContext'
import { ApiError, fetchModels, streamChat } from '../lib/api'
import {
  loadConversations,
  loadSettings,
  saveConversations,
  saveSettings,
} from '../lib/storage'
import type { Theme } from '../lib/storage'
import type {
  ChatMessage,
  ChatSettings,
  Conversation,
  ModelInfo,
  ProviderStatus,
} from '../lib/types'
import { createId, deriveTitle } from '../lib/utils'

interface ChatPageProps {
  theme: Theme
  onToggleTheme: () => void
}

type PendingDelete = { type: 'one'; id: string } | { type: 'all' } | null

/**
 * 模型名稱現在是「來源/模型」的合格名稱。
 * 舊版存下的裸名稱若只對應到一個來源就補上前綴，否則保持原樣（後端會退回預設來源）。
 */
function qualifyStoredModel(model: string, models: ModelInfo[]): string {
  if (!model || models.some((item) => item.id === model)) return model
  const matches = models.filter((item) => item.model === model)
  return matches.length === 1 ? matches[0].id : model
}

export default function ChatPage({ theme, onToggleTheme }: ChatPageProps) {
  const { session, signOut } = useAuth()
  const token = session?.token ?? ''

  const [conversations, setConversations] = useState<Conversation[]>(() => loadConversations())
  const [activeId, setActiveId] = useState<string | null>(null)
  const [models, setModels] = useState<ModelInfo[]>([])
  const [providers, setProviders] = useState<ProviderStatus[]>([])
  const [offlineDismissed, setOfflineDismissed] = useState(false)
  const [currentModel, setCurrentModel] = useState('')
  const [settings, setSettings] = useState<ChatSettings>(() => loadSettings())
  const [input, setInput] = useState('')
  const [streamingId, setStreamingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null)

  const abortRef = useRef<AbortController | null>(null)
  const frameRef = useRef<number | null>(null)
  const pendingRef = useRef<{ conversationId: string; messageId: string; text: string } | null>(null)

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeId) ?? null,
    [conversations, activeId],
  )

  // --- 持久化 ---
  useEffect(() => {
    saveConversations(conversations)
  }, [conversations])

  useEffect(() => {
    saveSettings(settings)
  }, [settings])

  // --- 取得可用模型 ---
  useEffect(() => {
    if (!token) return
    let cancelled = false
    fetchModels(token)
      .then((result) => {
        if (cancelled) return
        setModels(result.models)
        setProviders(result.providers)
        setOfflineDismissed(false)
        setCurrentModel((current) => {
          const qualified = qualifyStoredModel(current, result.models)
          return qualified || result.default_model || result.models[0]?.id || ''
        })
        setConversations((previous) => {
          let changed = false
          const next = previous.map((conversation) => {
            const qualified = qualifyStoredModel(conversation.model, result.models)
            if (qualified === conversation.model) return conversation
            changed = true
            return { ...conversation, model: qualified }
          })
          return changed ? next : previous
        })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        if (err instanceof ApiError && err.status === 401) {
          signOut()
          return
        }
        setError(
          err instanceof Error
            ? `無法取得模型清單：${err.message}`
            : '無法取得模型清單，請確認模型來源服務是否正常。',
        )
      })
    return () => {
      cancelled = true
    }
  }, [token, signOut])

  // 切換對話時同步模型選擇。
  useEffect(() => {
    if (activeConversation?.model) setCurrentModel(activeConversation.model)
  }, [activeConversation?.id, activeConversation?.model])

  // 離開頁面前中止串流。
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    }
  }, [])

  const flushPending = useCallback(() => {
    frameRef.current = null
    const pending = pendingRef.current
    if (!pending) return
    pendingRef.current = null
    setConversations((previous) =>
      previous.map((conversation) =>
        conversation.id === pending.conversationId
          ? {
              ...conversation,
              updatedAt: Date.now(),
              messages: conversation.messages.map((message) =>
                message.id === pending.messageId ? { ...message, content: pending.text } : message,
              ),
            }
          : conversation,
      ),
    )
  }, [])

  const patchMessage = useCallback(
    (conversationId: string, messageId: string, patch: Partial<ChatMessage>) => {
      setConversations((previous) =>
        previous.map((conversation) =>
          conversation.id === conversationId
            ? {
                ...conversation,
                updatedAt: Date.now(),
                messages: conversation.messages.map((message) =>
                  message.id === messageId ? { ...message, ...patch } : message,
                ),
              }
            : conversation,
        ),
      )
    },
    [],
  )

  /** 送出一次補全請求，history 為要送給模型的完整訊息串。 */
  const runCompletion = useCallback(
    async (conversationId: string, history: ChatMessage[], model: string) => {
      const assistantId = createId()
      const placeholder: ChatMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        createdAt: Date.now(),
        // 訊息上只顯示原生模型名稱，來源前綴留給請求本身使用。
        model: models.find((item) => item.id === model)?.model ?? model,
      }

      setConversations((previous) =>
        previous.map((conversation) =>
          conversation.id === conversationId
            ? { ...conversation, messages: [...history, placeholder], updatedAt: Date.now() }
            : conversation,
        ),
      )
      setStreamingId(assistantId)
      setError(null)

      const controller = new AbortController()
      abortRef.current = controller
      let accumulated = ''

      const systemPrompt = settings.systemPrompt.trim()
      const payloadMessages = [
        ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
        ...history.map((message) => ({ role: message.role, content: message.content })),
      ]

      try {
        await streamChat({
          token,
          model,
          messages: payloadMessages,
          settings,
          signal: controller.signal,
          onDelta: (delta) => {
            accumulated += delta
            pendingRef.current = { conversationId, messageId: assistantId, text: accumulated }
            if (frameRef.current === null) {
              frameRef.current = requestAnimationFrame(flushPending)
            }
          },
        })

        if (frameRef.current !== null) {
          cancelAnimationFrame(frameRef.current)
          frameRef.current = null
        }
        pendingRef.current = null
        patchMessage(conversationId, assistantId, {
          content: accumulated || '（模型沒有回傳任何內容）',
          error: accumulated ? undefined : true,
        })
      } catch (err: unknown) {
        if (frameRef.current !== null) {
          cancelAnimationFrame(frameRef.current)
          frameRef.current = null
        }
        pendingRef.current = null

        if (err instanceof DOMException && err.name === 'AbortError') {
          // 使用者主動停止：保留已產生的內容。
          patchMessage(conversationId, assistantId, {
            content: accumulated || '（已停止產生）',
          })
        } else if (err instanceof ApiError && err.status === 401) {
          signOut()
        } else {
          const message = err instanceof Error ? err.message : '發生未知錯誤。'
          setError(message)
          patchMessage(conversationId, assistantId, {
            content: accumulated ? `${accumulated}\n\n---\n\n⚠️ ${message}` : `⚠️ ${message}`,
            error: true,
          })
        }
      } finally {
        abortRef.current = null
        setStreamingId(null)
      }
    },
    [flushPending, models, patchMessage, settings, signOut, token],
  )

  const handleSend = useCallback(() => {
    const content = input.trim()
    if (!content || streamingId) return
    if (!currentModel) {
      setError('尚未選擇模型，請先確認模型來源是否有可用模型。')
      return
    }

    const now = Date.now()
    const userMessage: ChatMessage = { id: createId(), role: 'user', content, createdAt: now }

    let conversation = activeConversation
    if (!conversation) {
      conversation = {
        id: createId(),
        title: deriveTitle(content),
        messages: [],
        model: currentModel,
        createdAt: now,
        updatedAt: now,
      }
      setConversations((previous) => [conversation as Conversation, ...previous])
      setActiveId(conversation.id)
    }

    const history = [...conversation.messages, userMessage]
    const conversationId = conversation.id
    const title = conversation.messages.length === 0 ? deriveTitle(content) : conversation.title

    setConversations((previous) =>
      previous.map((item) =>
        item.id === conversationId
          ? { ...item, title, model: currentModel, messages: history, updatedAt: now }
          : item,
      ),
    )
    setInput('')
    void runCompletion(conversationId, history, currentModel)
  }, [activeConversation, currentModel, input, runCompletion, streamingId])

  const handleRegenerate = useCallback(() => {
    if (!activeConversation || streamingId) return
    const messages = activeConversation.messages
    const lastAssistantIndex = messages.map((m) => m.role).lastIndexOf('assistant')
    const history = lastAssistantIndex === -1 ? messages : messages.slice(0, lastAssistantIndex)
    if (history.length === 0) return
    void runCompletion(activeConversation.id, history, activeConversation.model || currentModel)
  }, [activeConversation, currentModel, runCompletion, streamingId])

  const handleStop = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const handleCreate = useCallback(() => {
    abortRef.current?.abort()
    setActiveId(null)
    setInput('')
    setError(null)
    setSidebarOpen(false)
  }, [])

  const handleSelect = useCallback((id: string) => {
    abortRef.current?.abort()
    setActiveId(id)
    setError(null)
    setSidebarOpen(false)
  }, [])

  const confirmDelete = useCallback(() => {
    if (!pendingDelete) return
    if (pendingDelete.type === 'all') {
      abortRef.current?.abort()
      setConversations([])
      setActiveId(null)
    } else {
      const id = pendingDelete.id
      if (id === activeId) {
        abortRef.current?.abort()
        setActiveId(null)
      }
      setConversations((previous) => previous.filter((conversation) => conversation.id !== id))
    }
    setPendingDelete(null)
  }, [activeId, pendingDelete])

  const handleModelChange = useCallback(
    (model: string) => {
      setCurrentModel(model)
      if (activeId) {
        setConversations((previous) =>
          previous.map((conversation) =>
            conversation.id === activeId ? { ...conversation, model } : conversation,
          ),
        )
      }
    },
    [activeId],
  )

  const messages = activeConversation?.messages ?? []
  const offlineProviders = providers.filter((provider) => !provider.reachable)

  return (
    <div className="flex h-full overflow-hidden bg-slate-50 dark:bg-slate-950">
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onSelect={handleSelect}
        onCreate={handleCreate}
        onDelete={(id) => setPendingDelete({ type: 'one', id })}
        onClearAll={() => setPendingDelete({ type: 'all' })}
        username={session?.username ?? ''}
        onSignOut={signOut}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* backdrop-blur 會讓 header 自成 stacking context，若不加 relative z-20，
            內部的模型下拉選單會被後方（position: relative）的訊息區蓋住而無法點擊。
            z-20 低於側邊欄的 z-30／z-40 與彈窗的 z-50，不影響它們。 */}
        <header className="relative z-20 flex items-center gap-2 border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur sm:px-6 dark:border-slate-800 dark:bg-slate-900/80">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 lg:hidden dark:hover:bg-slate-800"
            aria-label="開啟側邊欄"
          >
            <Menu className="h-5 w-5" />
          </button>

          <h1 className="mr-auto min-w-0 truncate text-sm font-semibold text-slate-700 sm:text-base dark:text-slate-200">
            {activeConversation?.title ?? '新對話'}
          </h1>

          <ModelSelect
            models={models}
            value={currentModel}
            onChange={handleModelChange}
            disabled={Boolean(streamingId)}
          />

          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="對話設定"
            title="對話設定"
          >
            <Settings2 className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={onToggleTheme}
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label={theme === 'dark' ? '切換為淺色模式' : '切換為深色模式'}
            title={theme === 'dark' ? '切換為淺色模式' : '切換為深色模式'}
          >
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
        </header>

        {offlineProviders.length > 0 && !offlineDismissed && (
          <div
            role="status"
            className="flex items-start gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 sm:px-6 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300"
          >
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="flex-1">
              以下模型來源目前無法連線：
              {offlineProviders.map((provider) => provider.label).join('、')}
              。其餘來源仍可正常使用。
            </span>
            <button
              type="button"
              onClick={() => setOfflineDismissed(true)}
              className="rounded p-0.5 transition hover:bg-amber-100 dark:hover:bg-amber-900/40"
              aria-label="關閉提示"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 border-b border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700 sm:px-6 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="flex-1">{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="rounded p-0.5 transition hover:bg-red-100 dark:hover:bg-red-900/40"
              aria-label="關閉提示"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <MessageList
          messages={messages}
          streamingId={streamingId}
          onRegenerate={handleRegenerate}
          onPickSuggestion={(prompt) => setInput(prompt)}
        />

        <Composer
          value={input}
          onChange={setInput}
          onSend={handleSend}
          onStop={handleStop}
          streaming={Boolean(streamingId)}
        />
      </div>

      <SettingsPanel
        open={settingsOpen}
        settings={settings}
        onClose={() => setSettingsOpen(false)}
        onSave={setSettings}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        title={pendingDelete?.type === 'all' ? '清除所有對話?' : '刪除這個對話?'}
        description={
          pendingDelete?.type === 'all'
            ? '所有對話紀錄將從瀏覽器中移除，此動作無法復原。'
            : '這個對話的所有訊息將被移除，此動作無法復原。'
        }
        confirmLabel={pendingDelete?.type === 'all' ? '全部清除' : '確定刪除'}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
