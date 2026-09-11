import { Loader2 } from 'lucide-react'
import { ANALYSIS_STAGES } from '@/services/analysisRunner'
import { useAnalysisStore } from '@/store/useAnalysisStore'

const STEP_STYLES = {
  done: { dot: 'bg-emerald-500', text: 'text-muted-foreground', status: 'done' },
  active: { dot: 'bg-violet-600 ring-4 ring-violet-100', text: 'font-medium text-foreground', status: 'in progress' },
  pending: { dot: 'bg-slate-200', text: 'text-muted-foreground/70', status: 'pending' },
}

export function AnalysisProgress() {
  const stage = useAnalysisStore((state) => state.stage)
  const currentIndex = ANALYSIS_STAGES.findIndex((item) => item.id === stage)

  return (
    <section
      className="rounded-xl border bg-white px-6 py-10 shadow-xs"
      aria-labelledby="analysis-progress-title"
      aria-busy="true"
    >
      <div className="mx-auto flex max-w-xs flex-col items-center text-center">
        <div className="grid size-14 place-items-center rounded-full bg-violet-50 ring-8 ring-violet-50/60">
          <Loader2 className="size-6 animate-spin text-violet-600" aria-hidden="true" />
        </div>
        <h2 id="analysis-progress-title" className="mt-5 text-lg font-semibold">
          Computing vectors
        </h2>
        <ol className="mt-4 grid w-full gap-2.5 text-left text-sm" aria-live="polite">
          {ANALYSIS_STAGES.map((item, index) => {
            const state = index < currentIndex ? 'done' : index === currentIndex ? 'active' : 'pending'
            const style = STEP_STYLES[state]
            return (
              <li
                key={item.id}
                className={`flex items-center gap-3 ${style.text}`}
                aria-current={state === 'active' ? 'step' : undefined}
              >
                <span className={`size-2 shrink-0 rounded-full ${style.dot}`} aria-hidden="true" />
                {item.label}
                <span className="sr-only">({style.status})</span>
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}
