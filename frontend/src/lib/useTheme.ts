import { useCallback, useEffect, useState } from 'react'
import { loadTheme, saveTheme } from './storage'
import type { Theme } from './storage'

/** 深色／淺色模式切換，寫入 <html> 的 class 與 localStorage。 */
export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => loadTheme())

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    document.documentElement.style.colorScheme = theme
    saveTheme(theme)
  }, [theme])

  const toggle = useCallback(() => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
  }, [])

  return [theme, toggle]
}
