import { LogOut, MessageSquarePlus, MessageSquareText, Sparkles, Trash2, User, X } from 'lucide-react'
import { cx, formatDay } from '../lib/utils'
import type { Conversation } from '../lib/types'

interface SidebarProps {
  conversations: Conversation[]
  activeId: string | null
  open: boolean
  onClose: () => void
  onSelect: (id: string) => void
  onCreate: () => void
  onDelete: (id: string) => void
  onClearAll: () => void
  username: string
  onSignOut: () => void
}

export default function Sidebar({
  conversations,
  activeId,
  open,
  onClose,
  onSelect,
  onCreate,
  onDelete,
  onClearAll,
  username,
  onSignOut,
}: SidebarProps) {
  return (
    <>
      {/* 行動裝置的遮罩 */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/50 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}

      <aside
        className={cx(
          'fixed inset-y-0 left-0 z-40 flex w-72 shrink-0 flex-col border-r border-slate-200 bg-white transition-transform duration-200 lg:static lg:translate-x-0 dark:border-slate-800 dark:bg-slate-900',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
              <Sparkles className="h-4 w-4" />
            </span>
            <span className="font-semibold tracking-tight">LiteLLM Chat</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden dark:hover:bg-slate-800"
            aria-label="關閉側邊欄"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-3">
          <button
            type="button"
            onClick={onCreate}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-500"
          >
            <MessageSquarePlus className="h-4 w-4" />
            開新對話
          </button>
        </div>

        <nav className="mt-4 flex-1 overflow-y-auto px-3 pb-4">
          <p className="px-2 pb-2 text-xs font-semibold tracking-wide text-slate-400 uppercase">
            對話紀錄
          </p>
          {conversations.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-slate-400">
              還沒有任何對話，
              <br />
              從上方開始吧。
            </p>
          ) : (
            <ul className="space-y-1">
              {conversations.map((conversation) => (
                <li key={conversation.id}>
                  <div
                    className={cx(
                      'group flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition',
                      conversation.id === activeId
                        ? 'bg-brand-50 text-brand-800 dark:bg-brand-900/40 dark:text-brand-100'
                        : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => onSelect(conversation.id)}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      title={conversation.title}
                    >
                      <MessageSquareText className="h-4 w-4 shrink-0 opacity-70" />
                      <span className="truncate">{conversation.title}</span>
                    </button>
                    <span className="shrink-0 text-[0.7rem] text-slate-400 group-hover:hidden">
                      {formatDay(conversation.updatedAt)}
                    </span>
                    <button
                      type="button"
                      onClick={() => onDelete(conversation.id)}
                      className="hidden shrink-0 rounded p-1 text-slate-400 transition hover:bg-red-100 hover:text-red-600 group-hover:block dark:hover:bg-red-900/40 dark:hover:text-red-300"
                      aria-label={`刪除對話「${conversation.title}」`}
                      title="刪除對話"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </nav>

        <div className="border-t border-slate-200 px-3 py-3 dark:border-slate-800">
          {conversations.length > 0 && (
            <button
              type="button"
              onClick={onClearAll}
              className="mb-2 flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-500 transition hover:bg-red-50 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-950/40 dark:hover:text-red-300"
            >
              <Trash2 className="h-4 w-4" />
              清除所有對話
            </button>
          )}

          <div className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2.5 dark:bg-slate-800/70">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white">
              <User className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{username}</p>
              <p className="text-xs text-slate-400">已登入</p>
            </div>
            <button
              type="button"
              onClick={onSignOut}
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-200 hover:text-red-600 dark:hover:bg-slate-700 dark:hover:text-red-300"
              aria-label="登出"
              title="登出"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>

          <p className="mt-2.5 text-center text-xs text-slate-400 dark:text-slate-500">
            由 Simon Liu 所製作
          </p>
        </div>
      </aside>
    </>
  )
}
