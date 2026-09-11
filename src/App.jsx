import { RotateCcw, SlidersHorizontal } from 'lucide-react'
import { AnalysisForm } from '@/components/config/AnalysisForm'
import { AnalysisProgress } from '@/components/config/AnalysisProgress'
import { AppShell } from '@/components/layout/AppShell'
import { SettingsPanel } from '@/components/layout/SettingsPanel'
import { Button } from '@/components/ui/button'
import { ComparisonVectorMap } from '@/components/visualizations/ComparisonVectorMap'
import { ProximityRadar } from '@/components/visualizations/ProximityRadar'
import { RelevanceChart } from '@/components/visualizations/RelevanceChart'
import { mockAnalysisResult } from '@/mocks/semanticData'
import { useAnalysisStore } from '@/store/useAnalysisStore'
import { RELEVANCE_ZONES } from '@/utils/relevanceZones'

const CHUNKING_LABELS = { layout: 'Layout-based chunking', semantic: 'Semantic AI chunking' }
const MODE_LABELS = { mock: 'Demo vectors', transformers: 'Transformers.js vectors', openai: 'OpenAI vectors' }

const formatPercent = (ratio) => `${(ratio * 100).toFixed(1)}%`
const plural = (count, noun) => `${count} ${noun}${count === 1 ? '' : 's'}`

function StatTile({ label, value, hint }) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function AnalysisConfiguration() {
  return (
    <div className="rounded-xl border bg-white shadow-xs">
      <div className="flex items-center gap-2 border-b px-6 py-4">
        <SlidersHorizontal className="size-4 text-violet-600" aria-hidden="true" />
        <h2 className="text-xs font-semibold uppercase tracking-wider">Analysis configuration</h2>
      </div>
      <div className="grid gap-8 p-6 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <AnalysisForm />
        <aside aria-label="Embedding settings" className="lg:border-l lg:pl-8">
          <SettingsPanel />
        </aside>
      </div>
    </div>
  )
}

function AnalysisOverview({ result, onReloadDemo }) {
  const { summary, options } = result
  const competitorPages = result.competitors.reduce((count, site) => count + site.pages.length, 0)
  const source =
    result.inputSource.type === 'url'
      ? result.inputSource.value
      : `Pasted text · ${result.sourceText.length.toLocaleString()} chars`
  const scope = options.contentScope === 'specific_section' ? `Section: ${options.sectionHeading}` : 'Complete article'

  return (
    <section className="rounded-xl border bg-white p-6 shadow-xs" aria-labelledby="overview-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Query context</p>
          <h2 id="overview-title" className="mt-1 font-mono text-lg break-words">
            {result.targetKeyword}
          </h2>
          <p className="mt-1 truncate text-sm text-muted-foreground">{source}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {CHUNKING_LABELS[options.chunkingStrategy]} · {scope} · {MODE_LABELS[result.embeddingMode]}
          </p>
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
          value={plural(summary.chunksNeedingOptimization, 'chunk')}
          hint={`of ${result.chunks.length} analyzed`}
        />
        <StatTile
          label="Competitor pages"
          value={competitorPages}
          hint={`across ${plural(result.competitors.length, 'site')}`}
        />
      </div>

      <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm" aria-label="Chunks per relevance zone">
        {Object.entries(RELEVANCE_ZONES).map(([zone, { label, range, color }]) => (
          <li key={zone} className="flex items-center gap-2">
            <span className="size-2.5 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
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
  const status = useAnalysisStore((state) => state.status)
  const setResult = useAnalysisStore((state) => state.setResult)

  let content
  if (status === 'running') content = <AnalysisProgress />
  else if (analysisResult) {
    content = (
      <>
        <AnalysisOverview result={analysisResult} onReloadDemo={() => setResult(mockAnalysisResult)} />
        <div className="grid gap-6 lg:grid-cols-2">
          <ProximityRadar />
          <RelevanceChart />
        </div>
        <ComparisonVectorMap />
      </>
    )
  } else {
    content = (
      <section className="rounded-xl border bg-white p-10 text-center text-sm text-muted-foreground">
        No analysis yet. Configure one above and run it.
      </section>
    )
  }

  return <AppShell settings={<AnalysisConfiguration />}>{content}</AppShell>
}

export default App
