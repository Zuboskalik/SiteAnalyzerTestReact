import { useEffect, useMemo, useRef, useState } from 'react'
import { select, zoom, zoomIdentity } from 'd3'
import { Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { mockComparisonMap } from '@/mocks/semanticData'
import { useAnalysisStore } from '@/store/useAnalysisStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import { comparisonMapFromAnalysis, tetherStats } from '@/utils/comparisonModel'
import { radialLayout } from '@/utils/vectorLayout'
import { FloatingTooltip } from './FloatingTooltip'
import { pointerPosition } from './tooltipPosition'

const WIDTH = 800
const HEIGHT = 560
const CX = WIDTH / 2
const CY = HEIGHT / 2
const RADIUS = 250
const MARKER_RADIUS = 6
const KEYWORD_FILL = '#f0b429'
const KEYWORD_STROKE = '#8d5b00'
const SCORE_RINGS = [9, 8, 7, 6, 5, 4, 3, 2, 1]

const DATASETS = [
  { value: 'analysis', label: 'Current analysis' },
  { value: 'sample', label: 'Sample: Law Firm SEO' },
]
const COLOR_MODES = [
  { value: 'site', label: 'Site' },
  { value: 'cluster', label: 'Cluster' },
]

/** Tether score on the reference UI's 0–10 scale. */
const formatScore = (similarity) => (Math.round(similarity * 100) / 10).toFixed(1)

function SegmentedControl({ label, options, value, onChange }) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-lg border bg-white p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className="rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground aria-pressed:bg-slate-900 aria-pressed:text-white"
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function Diamond({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" aria-hidden="true" className="shrink-0">
      <rect x={2.5} y={2.5} width={7} height={7} transform="rotate(45 6 6)" fill={KEYWORD_FILL} stroke={KEYWORD_STROKE} />
    </svg>
  )
}

export function ComparisonVectorMap() {
  const analysisResult = useAnalysisStore((state) => state.analysisResult)
  const tetherThreshold = useSettingsStore((state) => state.tetherThreshold)
  const setTetherThreshold = useSettingsStore((state) => state.setTetherThreshold)
  const [dataset, setDataset] = useState('analysis')
  const [colorBy, setColorBy] = useState('site')
  const [tooltip, setTooltip] = useState(null)
  const containerRef = useRef(null)
  const svgRef = useRef(null)
  const viewportRef = useRef(null)
  const zoomRef = useRef(null)

  const map = useMemo(
    () => (dataset === 'sample' || !analysisResult ? mockComparisonMap : comparisonMapFromAnalysis(analysisResult)),
    [dataset, analysisResult],
  )

  // Layout depends only on the data, never on the threshold, so moving the slider doesn't reshuffle points.
  const layout = useMemo(() => {
    const entries = map.sites.flatMap((site) => site.pages.map((page) => ({ page, site })))
    const farthest = Math.max(0.2, ...entries.map(({ page }) => 1 - page.similarityToKeyword))
    const maxDistance = Math.min(1, farthest * 1.1)
    const points = radialLayout(
      entries.map(({ page }) => page.embedding),
      map.keyword.embedding,
      { radius: RADIUS, maxDistance, markerRadius: MARKER_RADIUS },
    )
    return { maxDistance, nodes: entries.map((entry, i) => ({ ...entry, x: CX + points[i].x, y: CY + points[i].y })) }
  }, [map])

  const stats = useMemo(() => tetherStats(map, tetherThreshold), [map, tetherThreshold])
  const tethered = useMemo(
    () => layout.nodes.filter((node) => node.page.similarityToKeyword >= tetherThreshold),
    [layout, tetherThreshold],
  )

  const effectiveColorBy = map.clusters.length > 0 ? colorBy : 'site'
  const clusterColors = new Map(map.clusters.map((cluster) => [cluster.id, cluster.color]))
  const colorOf = (node) =>
    (effectiveColorBy === 'cluster' && clusterColors.get(node.page.clusterId)) || node.site.color
  const tetherStrength = (similarity) =>
    Math.min(1, Math.max(0, (similarity - tetherThreshold) / Math.max(1e-6, stats.bestSimilarity - tetherThreshold)))

  const legendRows =
    effectiveColorBy === 'cluster'
      ? map.clusters.map((cluster) => ({
          id: cluster.id,
          label: cluster.label,
          color: cluster.color,
          count: tethered.filter((node) => node.page.clusterId === cluster.id).length,
        }))
      : map.sites.map((site) => ({
          id: site.id,
          label: site.role === 'target' ? `${site.name} (you)` : site.name,
          color: site.color,
          count: stats.perSite[site.id],
        }))

  useEffect(() => {
    const svg = select(svgRef.current)
    const behavior = zoom()
      .scaleExtent([0.5, 8])
      .on('zoom', (event) => {
        select(viewportRef.current).attr('transform', event.transform)
        setTooltip(null)
      })
    zoomRef.current = behavior
    svg.call(behavior).on('dblclick.zoom', null)
    return () => {
      svg.on('.zoom', null)
    }
  }, [])

  useEffect(() => {
    select(svgRef.current).call(zoomRef.current.transform, zoomIdentity)
  }, [map])

  const zoomBy = (factor) => select(svgRef.current).transition().duration(200).call(zoomRef.current.scaleBy, factor)
  const resetZoom = () => select(svgRef.current).transition().duration(200).call(zoomRef.current.transform, zoomIdentity)

  return (
    <section className="overflow-hidden rounded-xl border bg-white shadow-xs" aria-labelledby="comparison-title">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-6 py-4">
        <div className="min-w-0">
          <h2 id="comparison-title" className="font-semibold">
            Comparison Map
          </h2>
          <p className="text-xs text-muted-foreground">
            Your pages and competitor pages in one semantic space, tethered to the keyword.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl label="Dataset" options={DATASETS} value={dataset} onChange={setDataset} />
          {map.clusters.length > 0 && (
            <SegmentedControl label="Color by" options={COLOR_MODES} value={effectiveColorBy} onChange={setColorBy} />
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-[17rem_minmax(0,1fr)]">
        <aside className="grid content-start gap-4 border-b p-5 lg:border-r lg:border-b-0" aria-label="Map summary and filter">
          <div className="grid gap-1">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Diamond />
              <span className="min-w-0 break-words">{map.keyword.text}</span>
            </p>
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {stats.total} of {layout.nodes.length} pages ≥ {formatScore(tetherThreshold)} · best{' '}
              {formatScore(stats.bestSimilarity)}/10
            </p>
          </div>

          <ul className="grid gap-1.5 text-xs" aria-label={effectiveColorBy === 'cluster' ? 'Clusters' : 'Sites'}>
            {legendRows.map((row) => (
              <li key={row.id} className="flex items-center gap-2">
                <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: row.color }} aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">{row.label}</span>
                <span className="tabular-nums text-muted-foreground">{row.count}</span>
              </li>
            ))}
          </ul>

          <div className="grid gap-2.5">
            <div className="flex items-center justify-between text-xs">
              <span id="tether-threshold-label" className="font-medium">
                Tether ≥
              </span>
              <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-medium tabular-nums">
                {formatScore(tetherThreshold)}
              </span>
            </div>
            <Slider
              aria-labelledby="tether-threshold-label"
              value={[tetherThreshold * 10]}
              min={0}
              max={10}
              step={0.1}
              onValueChange={([value]) => setTetherThreshold(Math.round(value * 10) / 100)}
            />
            <p className="text-[11px] leading-snug text-muted-foreground">
              Hides tethers to pages whose cosine similarity to the keyword is below the threshold (0–10 scale).
            </p>
          </div>
        </aside>

        <div ref={containerRef} className="relative bg-slate-50">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="block h-auto w-full cursor-grab touch-none select-none active:cursor-grabbing"
            role="img"
            aria-label={`${layout.nodes.length} pages around the keyword "${map.keyword.text}"; ${stats.total} tethered at ${formatScore(tetherThreshold)} or above.`}
          >
            <g ref={viewportRef}>
              {SCORE_RINGS.filter((score) => 1 - score / 10 <= layout.maxDistance).map((score) => {
                const r = ((1 - score / 10) / layout.maxDistance) * RADIUS
                return (
                  <g key={score}>
                    <circle cx={CX} cy={CY} r={r} fill="none" stroke="#e2e8f0" strokeDasharray="3 5" vectorEffect="non-scaling-stroke" />
                    <text x={CX + 4} y={CY - r - 3} fontSize={9} fill="#94a3b8">
                      {score}.0
                    </text>
                  </g>
                )
              })}

              {tethered.map((node) => {
                const strength = tetherStrength(node.page.similarityToKeyword)
                return (
                  <line
                    key={node.page.id}
                    x1={CX}
                    y1={CY}
                    x2={node.x}
                    y2={node.y}
                    stroke={colorOf(node)}
                    strokeOpacity={0.2 + 0.55 * strength}
                    strokeWidth={0.75 + 1.5 * strength}
                    vectorEffect="non-scaling-stroke"
                  />
                )
              })}

              {layout.nodes.map((node) => {
                const isTethered = node.page.similarityToKeyword >= tetherThreshold
                return (
                  <circle
                    key={node.page.id}
                    cx={node.x}
                    cy={node.y}
                    r={MARKER_RADIUS}
                    fill={colorOf(node)}
                    fillOpacity={isTethered ? 1 : 0.28}
                    stroke="#fff"
                    strokeWidth={1.5}
                    className="cursor-pointer"
                    onMouseMove={(event) => setTooltip({ node, ...pointerPosition(containerRef.current, event) })}
                    onMouseLeave={() => setTooltip(null)}
                  />
                )
              })}

              <g
                onMouseMove={(event) => setTooltip({ keyword: true, ...pointerPosition(containerRef.current, event) })}
                onMouseLeave={() => setTooltip(null)}
              >
                <rect
                  x={CX - 10}
                  y={CY - 10}
                  width={20}
                  height={20}
                  transform={`rotate(45 ${CX} ${CY})`}
                  fill={KEYWORD_FILL}
                  stroke={KEYWORD_STROKE}
                  strokeWidth={1.5}
                />
                <text
                  x={CX}
                  y={CY + 30}
                  textAnchor="middle"
                  fontSize={12}
                  fontWeight={600}
                  fill="#3f3f46"
                  stroke="#f8fafc"
                  strokeWidth={4}
                  paintOrder="stroke"
                >
                  {map.keyword.text}
                </text>
              </g>
            </g>
          </svg>

          <div className="absolute right-3 top-3 grid gap-1">
            <Button type="button" variant="outline" size="icon-sm" onClick={() => zoomBy(1.4)} aria-label="Zoom in">
              <Plus aria-hidden="true" />
            </Button>
            <Button type="button" variant="outline" size="icon-sm" onClick={() => zoomBy(1 / 1.4)} aria-label="Zoom out">
              <Minus aria-hidden="true" />
            </Button>
            <Button type="button" variant="outline" size="icon-sm" onClick={resetZoom} aria-label="Reset zoom" className="text-[11px]">
              1x
            </Button>
          </div>
          <p className="pointer-events-none absolute bottom-2 left-3 text-[11px] text-muted-foreground">
            Scroll to zoom · drag to pan
          </p>

          {tooltip && (
            <FloatingTooltip x={tooltip.x} y={tooltip.y} containerWidth={tooltip.containerWidth}>
              {tooltip.keyword ? (
                <div className="grid gap-0.5">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Target keyword</p>
                  <p className="font-medium text-foreground">{map.keyword.text}</p>
                </div>
              ) : (
                <div className="grid gap-1">
                  <p className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="size-2 rounded-full" style={{ backgroundColor: tooltip.node.site.color }} aria-hidden="true" />
                    {tooltip.node.site.name}
                  </p>
                  <p className="font-medium text-foreground">{tooltip.node.page.label}</p>
                  {tooltip.node.page.url && <p className="break-all text-muted-foreground">{tooltip.node.page.url}</p>}
                  <p>
                    Tether <strong className="tabular-nums">{formatScore(tooltip.node.page.similarityToKeyword)}/10</strong>
                    <span className="text-muted-foreground">
                      {' '}
                      · cos {tooltip.node.page.similarityToKeyword.toFixed(3)}
                    </span>
                  </p>
                </div>
              )}
            </FloatingTooltip>
          )}
        </div>
      </div>
    </section>
  )
}
