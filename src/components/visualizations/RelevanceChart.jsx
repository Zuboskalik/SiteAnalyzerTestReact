import { useMemo } from 'react'
import { CartesianGrid, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useAnalysisStore } from '@/store/useAnalysisStore'
import { BROAD_MATCH_FROM, HIGHLY_RELEVANT_ABOVE, RELEVANCE_ZONES } from '@/utils/relevanceZones'
import { ChunkTooltipContent } from './ChunkTooltipContent'

const LINE_COLOR = '#7c3aed'
const AXIS_TICK = { fontSize: 11, fill: '#64748b' }

const ZONE_BANDS = [
  { zone: 'noise', from: 0, to: BROAD_MATCH_FROM },
  { zone: 'broad_match', from: BROAD_MATCH_FROM, to: HIGHLY_RELEVANT_ABOVE },
  { zone: 'highly_relevant', from: HIGHLY_RELEVANT_ABOVE, to: 100 },
]

const shorten = (value, length = 16) => (value.length > length ? `${value.slice(0, length - 1)}…` : value)

function ScoreDot({ cx, cy, payload, highlightedId }) {
  if (cx == null || cy == null) return null
  const selected = payload.chunk.id === highlightedId
  return (
    <g>
      {selected && <circle cx={cx} cy={cy} r={9.5} fill="none" stroke={LINE_COLOR} strokeWidth={2.5} />}
      <circle
        cx={cx}
        cy={cy}
        r={selected ? 6 : 4.5}
        fill={RELEVANCE_ZONES[payload.chunk.relevanceZone].color}
        stroke="#fff"
        strokeWidth={1.5}
      />
    </g>
  )
}

function ActiveDot({ cx, cy, payload }) {
  if (cx == null || cy == null) return null
  return (
    <circle cx={cx} cy={cy} r={7} fill={RELEVANCE_ZONES[payload.chunk.relevanceZone].color} stroke="#fff" strokeWidth={2} />
  )
}

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  return (
    <div className="max-w-64 rounded-lg border bg-white px-3 py-2 text-xs shadow-lg">
      <ChunkTooltipContent chunk={payload[0].payload.chunk} />
    </div>
  )
}

export function RelevanceChart() {
  const result = useAnalysisStore((state) => state.analysisResult)
  const highlightedChunkId = useAnalysisStore((state) => state.highlightedChunkId)
  const setHighlightedChunkId = useAnalysisStore((state) => state.setHighlightedChunkId)

  const data = useMemo(
    () =>
      (result?.chunks ?? []).map((chunk) => ({
        chunk,
        label: chunk.label,
        score: Math.round(chunk.similarity * 1000) / 10,
      })),
    [result],
  )

  if (!result) return null

  function handleClick(state) {
    const index = state?.activeTooltipIndex
    const chunk = index == null ? null : data[Number(index)]?.chunk
    if (chunk) setHighlightedChunkId(highlightedChunkId === chunk.id ? null : chunk.id)
  }

  return (
    <section className="flex flex-col rounded-xl border bg-white p-6 shadow-xs" aria-labelledby="relevance-title">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="relevance-title" className="font-semibold">
          Semantic Relevance Dashboard
        </h2>
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Relevance (%) per chunk</p>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Chunks in content order. Click a point to highlight that chunk on both charts.
      </p>

      <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs" aria-label="Relevance zones">
        {Object.entries(RELEVANCE_ZONES).map(([zone, { label, range, color }]) => (
          <li key={zone} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
            {label}
            <span className="text-muted-foreground">({range})</span>
          </li>
        ))}
      </ul>

      <div className="mt-3 h-72 min-h-72 flex-1" role="group" aria-label="Relevance of each chunk, in content order">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} onClick={handleClick} margin={{ top: 10, right: 12, bottom: 4, left: -6 }}>
            {ZONE_BANDS.map((band) => (
              <ReferenceArea
                key={band.zone}
                y1={band.from}
                y2={band.to}
                fill={RELEVANCE_ZONES[band.zone].color}
                fillOpacity={0.08}
                strokeOpacity={0}
                ifOverflow="hidden"
              />
            ))}
            <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              tickFormatter={(value) => shorten(value)}
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={{ stroke: '#cbd5e1' }}
              interval="preserveStartEnd"
              minTickGap={16}
            />
            <YAxis
              domain={[0, 100]}
              ticks={[0, BROAD_MATCH_FROM, HIGHLY_RELEVANT_ABOVE, 100]}
              tickFormatter={(value) => `${value}%`}
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              width={48}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#c4b5fd', strokeDasharray: '4 4' }} />
            <Line
              type="monotone"
              dataKey="score"
              stroke={LINE_COLOR}
              strokeWidth={2}
              isAnimationActive={false}
              dot={({ key, ...props }) => <ScoreDot key={key} {...props} highlightedId={highlightedChunkId} />}
              activeDot={({ key, ...props }) => <ActiveDot key={key} {...props} />}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-right text-[11px] text-muted-foreground">Content flow (chunks) →</p>
    </section>
  )
}
