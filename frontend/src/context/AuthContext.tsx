import { createContext, use, useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import * as api from '../lib/api'
import { clearSession, loadSession, saveSession } from '../lib/storage'
import type { AuthSession } from '../lib/types'

interface AuthContextValue {
  session: AuthSession | null
  /** 首次載入時仍在驗證既有 token */
  initializing: boolean
  signIn: (username: string, password: string) => Promise<void>
  signOut: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null)
  const [initializing, setInitializing] = useState(true)

  useEffect(() => {
    const stored = loadSession()
    if (!stored) {
      setInitializing(false)
      return
    }
    let cancelled = false
    // 先信任本機 token，再向後端確認是否仍有效。
    api
      .fetchCurrentUser(stored.token)
      .then(() => {
        if (!cancelled) setSession(stored)
      })
      .catch(() => {
        clearSession()
      })
      .finally(() => {
        if (!cancelled) setInitializing(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const signIn = useCallback(async (username: string, password: string) => {
    const result = await api.login(username, password)
    const next: AuthSession = {
      token: result.access_token,
      username: result.username,
      expiresAt: Date.now() + result.expires_in * 1000,
    }
    saveSession(next)
    setSession(next)
  }, [])

  const signOut = useCallback(() => {
    clearSession()
    setSession(null)
  }, [])

  const value = useMemo(
    () => ({ session, initializing, signIn, signOut }),
    [session, initializing, signIn, signOut],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}

export function useAuth(): AuthContextValue {
  const context = use(AuthContext)
  if (!context) throw new Error('useAuth 必須在 AuthProvider 內使用。')
  return context
}
