import { useState } from 'react'
import type { FormEvent } from 'react'
import { AlertCircle, Eye, EyeOff, Loader2, LogIn, Moon, Sparkles, Sun } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import type { Theme } from '../lib/storage'

interface LoginPageProps {
  theme: Theme
  onToggleTheme: () => void
}

const HIGHLIGHTS = [
  '串流回覆，逐字即時顯示',
  '可切換各來源上的任一模型',
  '對話紀錄保存在你的瀏覽器',
]

export default function LoginPage({ theme, onToggleTheme }: LoginPageProps) {
  const { signIn } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (submitting) return
    setError(null)
    setSubmitting(true)
    try {
      await signIn(username.trim(), password)
    } catch (err) {
      setError(err instanceof Error ? err.message : '登入失敗，請稍後再試。')
      setSubmitting(false)
    }
  }

  return (
    <div className="flex h-full flex-col bg-slate-50 lg:flex-row dark:bg-slate-950">
      {/* 左側品牌區塊 */}
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-indigo-500 lg:flex lg:w-[46%] lg:flex-col lg:justify-between lg:p-12">
        <div className="absolute -top-24 -right-16 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-24 -left-10 h-80 w-80 rounded-full bg-white/10 blur-3xl" />

        <div className="relative flex items-center gap-2.5 text-white">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur">
            <Sparkles className="h-5 w-5" />
          </span>
          <span className="text-lg font-semibold tracking-tight">LiteLLM Chatbot UI</span>
        </div>

        <div className="relative text-white">
          <h1 className="text-4xl leading-tight font-bold">
            一個介面，
            <br />
            對接你所有的模型。
          </h1>
          <p className="mt-4 max-w-md text-white/80">
            透過 LiteLLM Proxy 與地端 vLLM 統一存取 OpenAI、Anthropic、Gemini
            等供應商，登入後即可直接開始對話。
          </p>
          <ul className="mt-8 space-y-3">
            {HIGHLIGHTS.map((item) => (
              <li key={item} className="flex items-center gap-3 text-white/90">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/20 text-xs">
                  ✓
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative text-sm text-white/60">
          <p className="font-medium text-white/80">由 Simon Liu 所製作</p>
          <p className="mt-1">Powered by FastAPI · React · LiteLLM</p>
        </div>
      </aside>

      {/* 右側登入表單 */}
      <main className="relative flex flex-1 items-center justify-center px-6 py-12">
        <button
          type="button"
          onClick={onToggleTheme}
          className="absolute top-5 right-5 rounded-lg p-2.5 text-slate-500 transition hover:bg-slate-200/70 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          aria-label={theme === 'dark' ? '切換為淺色模式' : '切換為深色模式'}
          title={theme === 'dark' ? '切換為淺色模式' : '切換為深色模式'}
        >
          {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>

        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white">
              <Sparkles className="h-5 w-5" />
            </span>
            <span className="text-lg font-semibold">LiteLLM Chatbot UI</span>
          </div>

          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">登入</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            請使用管理者提供的帳號密碼登入使用。
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label
                htmlFor="username"
                className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                帳號
              </label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                autoFocus
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="請輸入帳號"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-900 shadow-sm transition outline-none placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                密碼
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="請輸入密碼"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 pr-11 text-slate-900 shadow-sm transition outline-none placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute top-1/2 right-3 -translate-y-1/2 text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-200"
                  aria-label={showPassword ? '隱藏密碼' : '顯示密碼'}
                >
                  {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                </button>
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !username.trim() || !password}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 font-medium text-white shadow-sm transition hover:bg-brand-500 focus:ring-2 focus:ring-brand-500/40 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  登入中…
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4" />
                  登入
                </>
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-slate-400 lg:hidden dark:text-slate-500">
            由 Simon Liu 所製作
          </p>
        </div>
      </main>
    </div>
  )
}
