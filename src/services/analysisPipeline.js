import { classifyRelevanceZone } from '../utils/relevanceZones'
import { chunkText, cosineSimilarity, meanVector } from '../utils/vectorMath'

/** @typedef {import('../types/models').Chunk} Chunk */
/** @typedef {import('../types/models').PageVector} PageVector */
/** @typedef {import('../types/models').AnalysisResult} AnalysisResult */
/** @typedef {import('../types/models').AnalysisSummary} AnalysisSummary */
/** @typedef {import('../types/models').BlockType} BlockType */
/** @typedef {import('./embeddings/EmbeddingProvider').EmbeddingProvider} EmbeddingProvider */

/** @typedef {'chunking'|'embedding'|'scoring'|'aggregating'} PipelineStage */

const MARKDOWN_HEADING = /^(#{1,6})\s+(.+)$/
const MAX_HEADING_LENGTH = 80

/**
 * Headings come either from markdown (`## Title`) or from layout: a short
 * first line, not ending in a full stop, followed by a blank line.
 * @param {string} text
 * @returns {{ heading: string|null, blockType: BlockType }}
 */
export function detectHeading(text) {
  const lines = text.split(/\r?\n/)
  const firstLine = lines[0].trim()

  const markdown = firstLine.match(MARKDOWN_HEADING)
  if (markdown) return { heading: markdown[2].trim(), blockType: `h${markdown[1].length}` }

  const isLayoutHeading =
    lines.length > 2 &&
    lines[1].trim() === '' &&
    firstLine.length <= MAX_HEADING_LENGTH &&
    !firstLine.endsWith('.')

  // Plain text carries no heading level; section headings (h2) are the common case.
  return isLayoutHeading ? { heading: firstLine, blockType: 'h2' } : { heading: null, blockType: 'paragraph' }
}

function fallbackLabel(index, total) {
  if (index === 0) return 'Intro'
  if (index === total - 1) return 'Conclusion'
  return `Section ${index + 1}`
}

/**
 * @param {{ text: string, index: number, charStart: number, charEnd: number }[]} rawChunks
 * @param {number[][]} embeddings One per raw chunk, in the same order.
 * @param {number[]} keywordEmbedding
 * @returns {Chunk[]}
 */
export function scoreChunks(rawChunks, embeddings, keywordEmbedding) {
  return rawChunks.map((chunk, i) => {
    const { heading, blockType } = detectHeading(chunk.text)
    const similarity = cosineSimilarity(embeddings[i], keywordEmbedding)
    return {
      id: `chunk-${chunk.index + 1}`,
      ...chunk,
      label: heading ?? fallbackLabel(chunk.index, rawChunks.length),
      heading,
      blockType,
      embedding: embeddings[i],
      similarity,
      relevanceZone: classifyRelevanceZone(similarity),
    }
  })
}

/**
 * @param {Omit<PageVector, 'embedding'|'similarityToKeyword'|'url'|'competitorId'|'clusterId'|'chunkIds'> & {
 *   url?: string|null, competitorId?: string|null, clusterId?: string|null, chunkIds?: string[],
 *   embeddings: number[][], keywordEmbedding: number[]
 * }} page
 * @returns {PageVector}
 */
export function buildPageVector({
  id,
  url = null,
  label,
  type,
  competitorId = null,
  clusterId = null,
  chunkIds = [],
  embeddings,
  keywordEmbedding,
}) {
  const embedding = meanVector(embeddings)
  return {
    id,
    url,
    label,
    type,
    competitorId,
    clusterId,
    embedding,
    similarityToKeyword: cosineSimilarity(embedding, keywordEmbedding),
    chunkIds,
  }
}

const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length

/**
 * @param {Chunk[]} chunks Non-empty, with embeddings.
 * @returns {AnalysisSummary}
 */
export function summarizeChunks(chunks) {
  const zoneCounts = { highly_relevant: 0, broad_match: 0, noise: 0 }
  for (const chunk of chunks) zoneCounts[chunk.relevanceZone]++

  const centroid = meanVector(chunks.map((chunk) => chunk.embedding))
  return {
    averageRelevance: mean(chunks.map((chunk) => chunk.similarity)),
    cohesion: mean(chunks.map((chunk) => cosineSimilarity(chunk.embedding, centroid))),
    chunksNeedingOptimization: chunks.length - zoneCounts.highly_relevant,
    zoneCounts,
  }
}

/**
 * @typedef {Object} CompetitorInput
 * @property {string} id
 * @property {string} name
 * @property {string} url
 * @property {string} color
 * @property {{ id: string, url: string, label: string, text: string }[]} pages Already-fetched page text.
 */

/**
 * chunk → embed → cosine similarity → AnalysisResult. Every text goes to the
 * provider in a single `embed` call, so remote providers see one request.
 *
 * @param {Object} input
 * @param {string} input.keyword
 * @param {string} input.sourceText
 * @param {{ type: 'url'|'text', value: string }} input.inputSource
 * @param {import('../types/models').AnalysisMeta} [input.meta]
 * @param {CompetitorInput[]} [input.competitors]
 * @param {EmbeddingProvider} input.provider
 * @param {import('../utils/vectorMath').ChunkingOptions} [input.chunking]
 * @param {(stage: PipelineStage) => void} [input.onStage]
 * @returns {Promise<AnalysisResult>}
 */
export async function analyzeContent({
  keyword,
  sourceText,
  inputSource,
  meta = { targetAudience: '', contentPurpose: '', websiteNiche: '' },
  competitors = [],
  provider,
  chunking,
  onStage,
}) {
  const targetKeyword = keyword?.trim()
  if (!targetKeyword) throw new Error('Target keyword is required.')

  onStage?.('chunking')
  const rawChunks = chunkText(sourceText ?? '', chunking)
  if (rawChunks.length === 0) throw new Error('The source content is empty — there is nothing to analyze.')

  const competitorPages = competitors
    .flatMap((site) => site.pages.map((page) => ({ site, page, chunks: chunkText(page.text ?? '', chunking) })))
    .filter((entry) => entry.chunks.length > 0)

  onStage?.('embedding')
  const texts = [
    targetKeyword,
    ...rawChunks.map((chunk) => chunk.text),
    ...competitorPages.flatMap((entry) => entry.chunks.map((chunk) => chunk.text)),
  ]
  const vectors = await provider.embed(texts)
  if (vectors.length !== texts.length) {
    throw new Error(`Embedding provider returned ${vectors.length} vectors for ${texts.length} texts.`)
  }

  onStage?.('scoring')
  const keywordEmbedding = vectors[0]
  let cursor = 1
  const takeVectors = (count) => {
    const taken = vectors.slice(cursor, cursor + count)
    cursor += count
    return taken
  }
  const chunks = scoreChunks(rawChunks, takeVectors(rawChunks.length), keywordEmbedding)
  const embeddedCompetitorPages = competitorPages.map((entry) => ({
    ...entry,
    embeddings: takeVectors(entry.chunks.length),
  }))

  onStage?.('aggregating')
  const targetUrl = inputSource.type === 'url' ? inputSource.value : null
  const targetPage = buildPageVector({
    id: 'target-page',
    url: targetUrl,
    label: targetUrl ?? 'Analyzed text',
    type: 'target',
    chunkIds: chunks.map((chunk) => chunk.id),
    embeddings: chunks.map((chunk) => chunk.embedding),
    keywordEmbedding,
  })

  const competitorSites = competitors.map((site) => ({
    id: site.id,
    name: site.name,
    url: site.url,
    color: site.color,
    pages: embeddedCompetitorPages
      .filter((entry) => entry.site.id === site.id)
      .map(({ page, embeddings }) =>
        buildPageVector({
          id: page.id,
          url: page.url,
          label: page.label,
          type: 'competitor',
          competitorId: site.id,
          embeddings,
          keywordEmbedding,
        }),
      ),
  }))

  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    targetKeyword,
    keywordEmbedding,
    inputSource,
    meta,
    sourceText,
    chunks,
    summary: summarizeChunks(chunks),
    targetPage,
    competitors: competitorSites,
    deepAnalysis: null,
    embeddingMode: provider.id,
  }
}
