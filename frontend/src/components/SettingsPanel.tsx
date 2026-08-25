import { useEffect, useState } from 'react'
import { RotateCcw, Save, X } from 'lucide-react'
import { DEFAULT_SETTINGS } from '../lib/storage'
import type { ChatSettings } from '../lib/types'

interface SettingsPanelProps {
  open: boolean
  settings: ChatSettings
  onClose: () => void
  onSave: (settings: ChatSettings) => void
}

export default function SettingsPanel({ open, settings, onClose, onSave }: SettingsPanelProps) {
  const [draft, setDraft] = useState<ChatSettings>(settings)

  useEffect(() => {
    if (open) setDraft(settings)
  }, [open, settings])

  useEffect(() => {
    if (!open) return
    function handleKeydown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeydown)
    return () => document.removeEventListener('keydown', handleKeydown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} aria-hidden />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
      >
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <h3 id="settings-title" className="text-lg font-semibold">
            對話設定
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
            aria-label="關閉設定"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="max-h-[60vh] space-y-5 overflow-y-auto px-5 py-5">
          <div>
            <label htmlFor="system-prompt" className="mb-1.5 block text-sm font-medium">
              系統提示詞（System Prompt）
            </label>
            <textarea
              id="system-prompt"
              rows={4}
              value={draft.systemPrompt}
              onChange={(event) => setDraft({ ...draft, systemPrompt: event.target.value })}
              placeholder="設定助理的角色與回答風格，留空則不送出系統訊息。"
              className="w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25 dark:border-slate-700 dark:bg-slate-800"
            />
            <p className="mt-1 text-xs text-slate-400">每次送出對話時會作為第一則訊息。</p>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="temperature" className="text-sm font-medium">
                隨機性（Temperature）
              </label>
              <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs dark:bg-slate-800">
                {draft.temperature.toFixed(2)}
              </span>
            </div>
            <input
              id="temperature"
              type="range"
              min={0}
              max={2}
              step={0.05}
              value={draft.temperature}
              onChange={(event) => setDraft({ ...draft, temperature: Number(event.target.value) })}
              className="w-full accent-brand-600"
            />
            <div className="mt-1 flex justify-between text-xs text-slate-400">
              <span>0：精準穩定</span>
              <span>2：發散創意</span>
            </div>
          </div>

          <div>
            <label htmlFor="max-tokens" className="mb-1.5 block text-sm font-medium">
              回覆長度上限（Max Tokens）
            </label>
            <input
              id="max-tokens"
              type="number"
              min={1}
              max={32768}
              value={draft.maxTokens ?? ''}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  maxTokens: event.target.value ? Number(event.target.value) : null,
                })
              }
              placeholder="留空則使用模型預設值"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25 dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-slate-200 px-5 py-4 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setDraft(DEFAULT_SETTINGS)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <RotateCcw className="h-4 w-4" />
            回復預設
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm transition hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              取消
            </button>
            <button
              type="button"
              onClick={() => {
                onSave(draft)
                onClose()
              }}
              className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-500"
            >
              <Save className="h-4 w-4" />
              儲存設定
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
