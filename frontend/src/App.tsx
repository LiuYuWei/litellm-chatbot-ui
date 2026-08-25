import { Loader2 } from 'lucide-react'
import { useAuth } from './context/AuthContext'
import { useTheme } from './lib/useTheme'
import ChatPage from './pages/ChatPage'
import LoginPage from './pages/LoginPage'

export default function App() {
  const { session, initializing } = useAuth()
  const [theme, toggleTheme] = useTheme()

  if (initializing) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-3 text-slate-500 dark:text-slate-400">
          <Loader2 className="h-7 w-7 animate-spin" />
          <p className="text-sm">正在確認登入狀態…</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return <LoginPage theme={theme} onToggleTheme={toggleTheme} />
  }

  return <ChatPage theme={theme} onToggleTheme={toggleTheme} />
}
