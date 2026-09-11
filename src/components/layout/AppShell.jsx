import { Radar } from 'lucide-react'
import { useSettingsStore } from '@/store/useSettingsStore'

const MODE_BADGES = {
  mock: { label: 'Demo mode · mock data', dot: 'bg-amber-400' },
  transformers: { label: 'Transformers.js · local', dot: 'bg-emerald-500' },
  openai: { label: 'OpenAI embeddings', dot: 'bg-sky-500' },
}

/**
 * @param {{ settings?: import('react').ReactNode, children: import('react').ReactNode }} props
 */
export function AppShell({ settings, children }) {
  const embeddingMode = useSettingsStore((state) => state.embeddingMode)
  const badge = MODE_BADGES[embeddingMode]

  return (
    <div className="min-h-svh bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-10 border-b bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-linear-to-br from-violet-600 to-fuchsia-500 text-white shadow-sm">
            <Radar className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold leading-tight">
              Semantic <span className="text-violet-600">Relevance</span> &amp; Space Analyzer
            </p>
            <p className="truncate text-xs text-muted-foreground">Passage-level relevance and vector-space mapping</p>
          </div>
          <span
            className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full border bg-white px-2.5 py-1 text-xs font-medium"
            aria-live="polite"
          >
            <span className={`size-1.5 rounded-full ${badge.dot}`} aria-hidden="true" />
            {badge.label}
          </span>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:px-6">
        {settings && <section aria-label="Analysis settings">{settings}</section>}
        {children}
      </main>
    </div>
  )
}
