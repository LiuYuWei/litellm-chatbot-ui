import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Cpu, Search, Server } from 'lucide-react'
import { cx } from '../lib/utils'
import type { ModelInfo } from '../lib/types'

interface ModelSelectProps {
  models: ModelInfo[]
  value: string
  onChange: (model: string) => void
  disabled?: boolean
}

interface ProviderGroup {
  id: string
  label: string
  models: ModelInfo[]
}

/** 依來源分組並保持後端回傳的順序。 */
function groupByProvider(models: ModelInfo[]): ProviderGroup[] {
  const groups: ProviderGroup[] = []
  const index = new Map<string, ProviderGroup>()
  for (const model of models) {
    let group = index.get(model.provider)
    if (!group) {
      group = { id: model.provider, label: model.provider_label || model.provider, models: [] }
      index.set(model.provider, group)
      groups.push(group)
    }
    group.models.push(model)
  }
  return groups
}

export default function ModelSelect({ models, value, onChange, disabled }: ModelSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function handleKeydown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeydown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeydown)
    }
  }, [open])

  const selected = useMemo(() => models.find((model) => model.id === value), [models, value])

  const groups = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    const filtered = keyword
      ? models.filter(
          (model) =>
            model.model.toLowerCase().includes(keyword) ||
            model.provider_label.toLowerCase().includes(keyword),
        )
      : models
    return groupByProvider(filtered)
  }, [models, query])

  // 只有單一來源時不必顯示來源名稱，避免版面噪音。
  const multiProvider = useMemo(
    () => new Set(models.map((model) => model.provider)).size > 1,
    [models],
  )

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled || models.length === 0}
        onClick={() => {
          setOpen((current) => !current)
          setQuery('')
        }}
        className="flex max-w-[15rem] items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
      >
        <Cpu className="h-4 w-4 shrink-0 text-brand-500" />
        <span className="flex min-w-0 flex-col items-start leading-tight">
          <span className="w-full truncate">{selected?.model ?? value ?? '尚未選擇模型'}</span>
          {multiProvider && selected && (
            <span className="w-full truncate text-[0.65rem] font-normal text-slate-400 dark:text-slate-500">
              {selected.provider_label}
            </span>
          )}
        </span>
        <ChevronDown className={cx('h-4 w-4 shrink-0 transition', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-80 origin-top-right overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-800">
          <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2 dark:border-slate-700">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜尋模型或來源…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
            />
          </div>
          <ul className="max-h-72 overflow-y-auto py-1">
            {groups.length === 0 && (
              <li className="px-3 py-4 text-center text-sm text-slate-400">找不到符合的模型</li>
            )}
            {groups.map((group) => (
              <li key={group.id}>
                {multiProvider && (
                  <div className="sticky top-0 z-10 flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 text-[0.7rem] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-900/80 dark:text-slate-400">
                    <Server className="h-3 w-3 shrink-0" />
                    <span className="truncate">{group.label}</span>
                    <span className="ml-auto font-normal normal-case">{group.models.length}</span>
                  </div>
                )}
                <ul>
                  {group.models.map((model) => (
                    <li key={model.id}>
                      <button
                        type="button"
                        onClick={() => {
                          onChange(model.id)
                          setOpen(false)
                        }}
                        className={cx(
                          'flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition',
                          model.id === value
                            ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200'
                            : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700',
                        )}
                      >
                        <span className="truncate font-mono text-[0.8rem]">{model.model}</span>
                        {model.id === value && <Check className="h-4 w-4 shrink-0" />}
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
