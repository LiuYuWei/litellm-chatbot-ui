import { useEffect, useRef, useState } from 'react'
import { ArrowDown, Bot } from 'lucide-react'
import MessageBubble from './MessageBubble'
import type { ChatMessage } from '../lib/types'

const SUGGESTIONS = [
  { title: '解釋技術概念', prompt: '請用淺顯的比喻說明什麼是向量資料庫，以及它適合用在哪些場景。' },
  { title: '幫我寫程式', prompt: '請用 Python 寫一個讀取 CSV 並統計各欄位缺失值比例的函式，並加上型別註記。' },
  { title: '整理會議重點', prompt: '我等一下會貼上一段會議逐字稿，請幫我整理成決議事項、待辦事項與負責人。' },
  { title: '翻譯與潤稿', prompt: '請把以下這段中文改寫成專業、精簡的英文商務信件。' },
]

interface MessageListProps {
  messages: ChatMessage[]
  streamingId: string | null
  onRegenerate: () => void
  onPickSuggestion: (prompt: string) => void
}

export default function MessageList({
  messages,
  streamingId,
  onRegenerate,
  onPickSuggestion,
}: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const stickToBottom = useRef(true)
  const [showJumpButton, setShowJumpButton] = useState(false)

  // 使用者往上捲動時就停止自動跟隨。
  function handleScroll() {
    const element = containerRef.current
    if (!element) return
    const distance = element.scrollHeight - element.scrollTop - element.clientHeight
    stickToBottom.current = distance < 80
    setShowJumpButton(distance > 240)
  }

  function scrollToBottom(behavior: ScrollBehavior = 'smooth') {
    const element = containerRef.current
    if (!element) return
    element.scrollTo({ top: element.scrollHeight, behavior })
    stickToBottom.current = true
  }

  useEffect(() => {
    if (stickToBottom.current) {
      containerRef.current?.scrollTo({ top: containerRef.current.scrollHeight })
    }
  }, [messages])

  const lastAssistantId = [...messages].reverse().find((m) => m.role === 'assistant')?.id

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center overflow-y-auto px-6 py-10">
        <div className="w-full max-w-2xl text-center">
          <span className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-600/30">
            <Bot className="h-7 w-7" />
          </span>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">今天想聊點什麼?</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            直接在下方輸入問題，或先從這些範例開始。
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {SUGGESTIONS.map((item) => (
              <button
                key={item.title}
                type="button"
                onClick={() => onPickSuggestion(item.prompt)}
                className="rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-brand-400 hover:shadow-md dark:border-slate-700 dark:bg-slate-800/60 dark:hover:border-brand-500"
              >
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {item.title}
                </p>
                <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                  {item.prompt}
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex-1 overflow-hidden">
      <div ref={containerRef} onScroll={handleScroll} className="h-full overflow-y-auto">
        <div className="mx-auto max-w-4xl py-4">
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              streaming={message.id === streamingId}
              canRegenerate={
                message.role === 'assistant' && message.id === lastAssistantId && !streamingId
              }
              onRegenerate={onRegenerate}
            />
          ))}
        </div>
      </div>

      {showJumpButton && (
        <button
          type="button"
          onClick={() => scrollToBottom()}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-slate-200 bg-white p-2 text-slate-500 shadow-lg transition hover:text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          aria-label="回到最新訊息"
        >
          <ArrowDown className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
