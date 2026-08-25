import { memo, useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { AlertTriangle, Bot, Check, Copy, RefreshCw, User } from 'lucide-react'
import CodeBlock from './CodeBlock'
import { cx, formatTime } from '../lib/utils'
import type { ChatMessage } from '../lib/types'

interface MessageBubbleProps {
  message: ChatMessage
  streaming: boolean
  canRegenerate: boolean
  onRegenerate: () => void
}

function MessageBubble({ message, streaming, canRegenerate, onRegenerate }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false)
  const isUser = message.role === 'user'

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(message.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      // 未授權剪貼簿時忽略。
    }
  }

  return (
    <div className={cx('group flex gap-3 px-4 py-4 sm:px-6', isUser && 'flex-row-reverse')}>
      <span
        className={cx(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white shadow-sm',
          isUser ? 'bg-slate-500' : message.error ? 'bg-red-500' : 'bg-brand-600',
        )}
      >
        {isUser ? (
          <User className="h-4 w-4" />
        ) : message.error ? (
          <AlertTriangle className="h-4 w-4" />
        ) : (
          <Bot className="h-4 w-4" />
        )}
      </span>

      <div className={cx('flex min-w-0 max-w-[min(46rem,88%)] flex-col', isUser && 'items-end')}>
        <div className="mb-1 flex items-center gap-2 text-xs text-slate-400">
          <span className="font-medium text-slate-500 dark:text-slate-400">
            {isUser ? '你' : (message.model ?? '助理')}
          </span>
          <span>{formatTime(message.createdAt)}</span>
        </div>

        <div
          className={cx(
            'rounded-2xl px-4 py-3 shadow-sm',
            isUser
              ? 'bg-brand-600 text-white'
              : message.error
                ? 'border border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300'
                : 'border border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100',
          )}
        >
          {isUser ? (
            <p className="text-[0.95rem] leading-7 whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className={cx('markdown-body', streaming && !message.content && 'streaming-caret')}>
              <Markdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }]]}
                components={{ pre: ({ children }) => <CodeBlock>{children}</CodeBlock> }}
              >
                {message.content}
              </Markdown>
            </div>
          )}
        </div>

        {/* 操作列：滑鼠移入時顯示 */}
        {!streaming && message.content && (
          <div
            className={cx(
              'mt-1.5 flex items-center gap-1 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100',
              isUser && 'flex-row-reverse',
            )}
          >
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? '已複製' : '複製'}
            </button>
            {canRegenerate && (
              <button
                type="button"
                onClick={onRegenerate}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                重新產生
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default memo(MessageBubble)
