/** 合併 className，忽略 falsy 值。 */
export function cx(...values: (string | false | null | undefined)[]): string {
  return values.filter(Boolean).join(' ')
}

export function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/** 以第一則使用者訊息產生對話標題。 */
export function deriveTitle(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (!clean) return '新對話'
  return clean.length > 24 ? `${clean.slice(0, 24)}…` : clean
}

export function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('zh-TW', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatDay(timestamp: number): string {
  const date = new Date(timestamp)
  const today = new Date()
  const isToday = date.toDateString() === today.toDateString()
  if (isToday) return '今天'
  return date.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })
}
