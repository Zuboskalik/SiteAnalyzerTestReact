import { useEffect, useRef } from 'react'
import { RELEVANCE_ZONES } from '@/utils/relevanceZones'
import { useAnalysisStore } from '@/store/useAnalysisStore'

/**
 * @typedef {import('../../types/models').Chunk} Chunk
 */

/**
 * Displays the full source text with chunk boundaries and highlights the selected chunk.
 * @param {{ chunks: Chunk[], sourceText: string }} props
 */
export function SourceTextPanel({ chunks, sourceText }) {
  const highlightedChunkId = useAnalysisStore((state) => state.highlightedChunkId)
  const toggleHighlightedChunkId = useAnalysisStore((state) => state.toggleHighlightedChunkId)
  const highlightedRef = useRef(null)

  // Auto-scroll to highlighted chunk when it changes
  useEffect(() => {
    if (highlightedChunkId && highlightedRef.current) {
      highlightedRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [highlightedChunkId])

  if (!chunks || chunks.length === 0) {
    return (
      <section className="rounded-xl border bg-white p-10 text-center text-sm text-muted-foreground">
        No text content available. Run an analysis to see the source text with chunk boundaries.
      </section>
    )
  }

  // Sort chunks by character position to ensure correct rendering order
  const sortedChunks = [...chunks].sort((a, b) => a.charStart - b.charStart)

  // Build the text with chunk boundaries
  let lastEnd = 0
  const segments = []

  for (const chunk of sortedChunks) {
    // Add any text before this chunk (shouldn't happen if chunks cover the whole text)
    if (chunk.charStart > lastEnd) {
      segments.push({
        type: 'gap',
        text: sourceText.slice(lastEnd, chunk.charStart),
      })
    }

    segments.push({
      type: 'chunk',
      chunk,
      text: sourceText.slice(chunk.charStart, chunk.charEnd),
    })

    lastEnd = chunk.charEnd
  }

  // Add any remaining text after the last chunk
  if (lastEnd < sourceText.length) {
    segments.push({
      type: 'gap',
      text: sourceText.slice(lastEnd),
    })
  }

  const handleChunkClick = (chunkId) => {
    toggleHighlightedChunkId(chunkId)
  }

  return (
    <section className="rounded-xl border bg-white shadow-xs" aria-label="Source text with chunk boundaries">
      <div className="flex items-center gap-2 border-b px-6 py-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-900">Source Text</h2>
        <span className="text-xs text-muted-foreground">({chunks.length} chunks)</span>
      </div>
      <div className="max-h-[600px] overflow-y-auto p-6">
        <div className="prose prose-sm max-w-none">
          {segments.map((segment, index) => {
            if (segment.type === 'gap') {
              return <span key={`gap-${index}`}>{segment.text}</span>
            }

            const { chunk } = segment
            const isHighlighted = highlightedChunkId === chunk.id
            const zone = chunk.relevanceZone
            const zoneConfig = RELEVANCE_ZONES[zone]

            return (
              <span
                key={chunk.id}
                ref={isHighlighted ? highlightedRef : null}
                onClick={() => handleChunkClick(chunk.id)}
                className={`
                  relative cursor-pointer rounded px-0.5 py-0.5 transition-colors
                  hover:bg-violet-50
                  ${isHighlighted ? 'bg-violet-100 ring-2 ring-violet-500 ring-offset-2' : ''}
                `}
                title={`${chunk.label} · ${(chunk.similarity * 100).toFixed(0)}% · ${zoneConfig.label}`}
                style={{
                  backgroundColor: isHighlighted ? undefined : `${zoneConfig.color}15`,
                }}
                role="button"
                tabIndex={0}
                aria-pressed={isHighlighted}
                aria-label={`Chunk: ${chunk.label}, relevance: ${(chunk.similarity * 100).toFixed(0)}%, zone: ${zoneConfig.label}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    handleChunkClick(chunk.id)
                  }
                }}
              >
                {segment.text}
              </span>
            )
          })}
        </div>
      </div>
    </section>
  )
}
