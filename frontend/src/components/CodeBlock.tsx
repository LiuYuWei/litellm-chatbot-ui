import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Check, Copy } from 'lucide-react'

/** 程式碼區塊：右上角提供複製按鈕。 */
export default function CodeBlock({ children }: { children: ReactNode }) {
  const preRef = useRef<HTMLPreElement>(null)
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    const text = preRef.current?.innerText ?? ''
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      // 未授權剪貼簿時忽略。
    }
  }

  return (
    <div className="group/code relative">
      <button
        type="button"
        onClick={handleCopy}
        className="absolute top-2.5 right-2.5 z-10 rounded-md bg-slate-700/80 p-1.5 text-slate-200 opacity-0 transition group-hover/code:opacity-100 hover:bg-slate-600 focus:opacity-100"
        aria-label="複製程式碼"
        title="複製程式碼"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
      <pre ref={preRef}>{children}</pre>
    </div>
  )
}
