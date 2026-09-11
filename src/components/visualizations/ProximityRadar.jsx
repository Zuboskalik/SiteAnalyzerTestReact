import { useMemo, useRef, useState } from 'react'
import { useAnalysisStore } from '@/store/useAnalysisStore'
import { BROAD_MATCH_FROM, HIGHLY_RELEVANT_ABOVE, RELEVANCE_ZONES } from '@/utils/relevanceZones'
import { radialLayout } from '@/utils/vectorLayout'
import { ChunkTooltipContent } from './ChunkTooltipContent'
import { FloatingTooltip } from './FloatingTooltip'
import { elementPosition, pointerPosition } from './tooltipPosition'

const SIZE = 480
const CENTER = SIZE / 2
const RADIUS = 205
const MARKER_RADIUS = 7
const QUERY_COLOR = '#6d28d9'

// Zone bands as distances (1 − cos) from the keyword, outermost first so inner bands paint on top.
const ZONE_BANDS = [
  { zone: 'noise', outer: 1 },
  { zone: 'broad_match', outer: 1 - BROAD_MATCH_FROM / 100 },
  { zone: 'highly_relevant', outer: 1 - HIGHLY_RELEVANT_ABOVE / 100 },
]

export function ProximityRadar() {
  const result = useAnalysisStore((state) => state.analysisResult)
  const highlightedChunkId = useAnalysisStore((state) => state.highlightedChunkId)
  const setHighlightedChunkId = useAnalysisStore((state) => state.setHighlightedChunkId)
  const containerRef = useRef(null)
  const [tooltip, setTooltip] = useState(null)

  const points = useMemo(() => {
    if (!result) return []
    const layout = radialLayout(
      result.chunks.map((chunk) => chunk.embedding),
      result.keywordEmbedding,
      { radius: RADIUS, markerRadius: MARKER_RADIUS },
    )
    return result.chunks.map((chunk, i) => ({ chunk, x: CENTER + layout[i].x, y: CENTER + layout[i].y }))
  }, [result])

  if (!result) return null

  const keywordLabel =
    result.targetKeyword.length > 30 ? `${result.targetKeyword.slice(0, 29).trimEnd()}…` : result.targetKeyword
  const toggle = (chunkId) => setHighlightedChunkId(highlightedChunkId === chunkId ? null : chunkId)

  return (
    <section className="rounded-xl border bg-white p-6 shadow-xs" aria-labelledby="radar-title">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="radar-title" className="font-semibold">
          Semantic Proximity Map
        </h2>
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
          Query · centre · {points.length} nodes
        </p>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Each chunk sits at a distance of 1 − cos from the keyword: the closer, the more relevant.
      </p>

      <div ref={containerRef} className="relative mt-4">
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="mx-auto block h-auto w-full max-w-[480px]"
          role="group"
          aria-label={`${points.length} chunks placed around the keyword "${result.targetKeyword}"`}
        >
          {ZONE_BANDS.map(({ zone, outer }) => (
            <circle
              key={zone}
              cx={CENTER}
              cy={CENTER}
              r={outer * RADIUS}
              fill={RELEVANCE_ZONES[zone].tint}
              stroke={RELEVANCE_ZONES[zone].color}
              strokeOpacity={0.35}
              strokeDasharray="3 4"
            />
          ))}
          <line x1={CENTER - RADIUS} y1={CENTER} x2={CENTER + RADIUS} y2={CENTER} stroke="#e2e8f0" />
          <line x1={CENTER} y1={CENTER - RADIUS} x2={CENTER} y2={CENTER + RADIUS} stroke="#e2e8f0" />
          {ZONE_BANDS.map(({ zone, outer }) => (
            <text key={zone} x={CENTER + 5} y={CENTER - outer * RADIUS + 13} fontSize={10} fill="#94a3b8">
              {Math.round((1 - outer) * 100)}%
            </text>
          ))}

          <g
            onMouseMove={(event) =>
              setTooltip({ query: true, ...pointerPosition(containerRef.current, event) })
            }
            onMouseLeave={() => setTooltip(null)}
          >
            <circle cx={CENTER} cy={CENTER} r={24} fill={QUERY_COLOR} fillOpacity={0.12} />
            <circle cx={CENTER} cy={CENTER} r={9} fill={QUERY_COLOR} stroke="#fff" strokeWidth={2} />
            <text
              x={CENTER}
              y={CENTER + 40}
              textAnchor="middle"
              fontSize={11}
              fontWeight={600}
              fill="#4c1d95"
              stroke="#fff"
              strokeWidth={3}
              paintOrder="stroke"
            >
              {keywordLabel}
            </text>
          </g>

          {points.map(({ chunk, x, y }) => {
            const selected = chunk.id === highlightedChunkId
            const zone = RELEVANCE_ZONES[chunk.relevanceZone]
            return (
              <g
                key={chunk.id}
                transform={`translate(${x} ${y})`}
                role="button"
                tabIndex={0}
                aria-label={`${chunk.label}: ${Math.round(chunk.similarity * 100)}%, ${zone.label}`}
                aria-pressed={selected}
                className="cursor-pointer outline-none [&:focus-visible>.focus-ring]:opacity-100"
                onClick={() => toggle(chunk.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    toggle(chunk.id)
                  }
                }}
                onMouseMove={(event) => setTooltip({ chunk, ...pointerPosition(containerRef.current, event) })}
                onMouseLeave={() => setTooltip(null)}
                onFocus={(event) =>
                  setTooltip({ chunk, ...elementPosition(containerRef.current, event.currentTarget) })
                }
                onBlur={() => setTooltip(null)}
              >
                <circle
                  className="focus-ring opacity-0"
                  r={MARKER_RADIUS + 7}
                  fill="none"
                  stroke={QUERY_COLOR}
                  strokeWidth={1.5}
                  strokeDasharray="2 2"
                />
                {selected && <circle r={MARKER_RADIUS + 5} fill="none" stroke={QUERY_COLOR} strokeWidth={2.5} />}
                <circle
                  r={selected ? MARKER_RADIUS + 1.5 : MARKER_RADIUS}
                  fill={zone.color}
                  stroke="#fff"
                  strokeWidth={2}
                />
              </g>
            )
          })}
        </svg>

        {tooltip && (
          <FloatingTooltip x={tooltip.x} y={tooltip.y} containerWidth={tooltip.containerWidth}>
            {tooltip.query ? (
              <div className="grid gap-0.5">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Query</p>
                <p className="font-medium text-foreground">{result.targetKeyword}</p>
              </div>
            ) : (
              <ChunkTooltipContent chunk={tooltip.chunk} />
            )}
          </FloatingTooltip>
        )}
      </div>

      <ul className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
        <li className="flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ backgroundColor: QUERY_COLOR }} aria-hidden="true" />
          Query
        </li>
        {Object.entries(RELEVANCE_ZONES).map(([zone, { label, color }]) => (
          <li key={zone} className="flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
            {label}
          </li>
        ))}
        <li className="ml-auto normal-case tracking-normal">r ∝ 1 − cos θ</li>
      </ul>
    </section>
  )
}
