import { RELEVANCE_ZONES } from '@/utils/relevanceZones'

const EXCERPT_LENGTH = 150

/** @param {{ chunk: import('@/types/models').Chunk }} props */
export function ChunkTooltipContent({ chunk }) {
  const zone = RELEVANCE_ZONES[chunk.relevanceZone]
  const body = chunk.heading ? chunk.text.slice(chunk.text.indexOf(chunk.heading) + chunk.heading.length).trim() : chunk.text
  const excerpt = body.length > EXCERPT_LENGTH ? `${body.slice(0, EXCERPT_LENGTH).trimEnd()}…` : body

  return (
    <div className="grid gap-1">
      <p className="font-medium text-foreground">{chunk.label}</p>
      <p className="flex items-center gap-1.5">
        <span className="size-2 rounded-full" style={{ backgroundColor: zone.color }} aria-hidden="true" />
        <strong className="tabular-nums">{Math.round(chunk.similarity * 100)}%</strong>
        <span className="text-muted-foreground">· {zone.label}</span>
      </p>
      {excerpt && <p className="leading-snug text-muted-foreground">{excerpt}</p>}
    </div>
  )
}
