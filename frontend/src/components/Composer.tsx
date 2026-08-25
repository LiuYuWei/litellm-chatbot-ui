import { useEffect, useRef } from 'react'
import type { KeyboardEvent } from 'react'
import { CornerDownLeft, Send, Square } from 'lucide-react'
import { cx } from '../lib/utils'

interface ComposerProps {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  onStop: () => void
  streaming: boolean
  disabled?: boolean
}

const MAX_HEIGHT = 200

export default function Composer({
  value,
  onChange,
  onSend,
  onStop,
  streaming,
  disabled,
}: ComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // 依內容高度自動調整輸入框。
  useEffect(() => {
    const element = textareaRef.current
    if (!element) return
    element.style.height = 'auto'
    element.style.height = `${Math.min(element.scrollHeight, MAX_HEIGHT)}px`
  }, [value])

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter 送出、Shift+Enter 換行；輸入法組字中不送出。
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      if (!streaming && value.trim()) onSend()
    }
  }

  return (
    <div className="border-t border-slate-200 bg-white/80 px-4 py-3 backdrop-blur sm:px-6 dark:border-slate-800 dark:bg-slate-900/80">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-end gap-2 rounded-2xl border border-slate-300 bg-white p-2 shadow-sm transition focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/25 dark:border-slate-700 dark:bg-slate-800">
          <textarea
            ref={textareaRef}
            rows={1}
            value={value}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={streaming ? '正在回覆中…' : '輸入訊息，按 Enter 送出、Shift + Enter 換行'}
            className="scrollbar-none max-h-[200px] flex-1 resize-none bg-transparent px-2 py-2 text-[0.95rem] leading-6 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed dark:placeholder:text-slate-500"
          />

          {streaming ? (
            <button
              type="button"
              onClick={onStop}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-700 text-white transition hover:bg-slate-600"
              aria-label="停止產生"
              title="停止產生"
            >
              <Square className="h-4 w-4 fill-current" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onSend}
              disabled={disabled || !value.trim()}
              className={cx(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white transition',
                'bg-brand-600 hover:bg-brand-500 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-700',
              )}
              aria-label="送出訊息"
              title="送出訊息"
            >
              <Send className="h-4 w-4" />
            </button>
          )}
        </div>

        <p className="mt-2 flex items-center justify-center gap-1.5 text-[0.7rem] text-slate-400">
          <CornerDownLeft className="h-3 w-3" />
          Enter 送出 · Shift + Enter 換行 · AI 產生的內容請自行核實
        </p>
      </div>
    </div>
  )
}
