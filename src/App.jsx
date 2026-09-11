import { RotateCcw, SlidersHorizontal } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { mockAnalysisResult } from '@/mocks/semanticData'
import { useAnalysisStore } from '@/store/useAnalysisStore'
import { RELEVANCE_ZONES } from '@/utils/relevanceZones'

const ZONE_DOTS = {
  highly_relevant: 'bg-emerald-500',
  broad_match: 'bg-amber-400',
  noise: 'bg-rose-500',
}

const formatPercent = (ratio) => `${(ratio * 100).toFixed(1)}%`

function StatTile({ label, value, hint }) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function SettingsPlaceholder() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-dashed bg-white px-5 py-4 text-sm text-muted-foreground">
      <SlidersHorizontal className="size-4 shrink-0" aria-hidden="true" />
      Analysis configuration and embedding settings are added in Phase 3.
    </div>
  )
}

function AnalysisOverview({ result, onReloadDemo }) {
  const { summary } = result
  const competitorPages = result.competitors.reduce((count, site) => count + site.pages.length, 0)

  return (
    <section className="rounded-xl border bg-white p-6 shadow-xs" aria-labelledby="overview-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Query context</p>
          <h1 id="overview-title" className="mt-1 font-mono text-lg break-words">
            {result.targetKeyword}
          </h1>
          <p className="mt-1 truncate text-sm text-muted-foreground">{result.inputSource.value}</p>
        </div>
        <Button variant="outline" size="sm" onClick={onReloadDemo}>
          <RotateCcw aria-hidden="true" />
          Reload demo data
        </Button>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Avg relevance" value={formatPercent(summary.averageRelevance)} />
        <StatTile label="Overall cohesion" value={`${Math.round(summary.cohesion * 100)} IDX`} />
        <StatTile
          label="Optimization needed"
          value={`${summary.chunksNeedingOptimization} chunks`}
          hint={`of ${result.chunks.length} analyzed`}
        />
        <StatTile
          label="Competitor pages"
          value={competitorPages}
          hint={`across ${result.competitors.length} sites`}
        />
      </div>

      <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm" aria-label="Chunks per relevance zone">
        {Object.entries(RELEVANCE_ZONES).map(([zone, { label, range }]) => (
          <li key={zone} className="flex items-center gap-2">
            <span className={`size-2.5 rounded-full ${ZONE_DOTS[zone]}`} aria-hidden="true" />
            {label}
            <span className="text-muted-foreground">{range}</span>
            <strong className="tabular-nums">{summary.zoneCounts[zone]}</strong>
          </li>
        ))}
      </ul>
    </section>
  )
}

function App() {
  const analysisResult = useAnalysisStore((state) => state.analysisResult)
  const setResult = useAnalysisStore((state) => state.setResult)

  return (
    <AppShell settings={<SettingsPlaceholder />}>
      {analysisResult ? (
        <AnalysisOverview result={analysisResult} onReloadDemo={() => setResult(mockAnalysisResult)} />
      ) : (
        <section className="rounded-xl border bg-white p-10 text-center text-sm text-muted-foreground">
          No analysis yet. Run one from the configuration panel.
        </section>
      )}
    </AppShell>
  )
}

export default App
