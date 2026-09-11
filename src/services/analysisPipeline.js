import { parseHeadingLine } from '../utils/headings'
import { classifyRelevanceZone } from '../utils/relevanceZones'
import { chunkText, cosineSimilarity, meanVector, splitSentences } from '../utils/vectorMath'
import { semanticChunks } from './semanticChunking'
import { generateMockDeepAnalysis } from './deepAnalysisService'

/** @typedef {import('../types/models').Chunk} Chunk */
/** @typedef {import('../types/models').PageVector} PageVector */
/** @typedef {import('../types/models').AnalysisResult} AnalysisResult */
/** @typedef {import('../types/models').AnalysisSummary} AnalysisSummary */
/** @typedef {import('../types/models').BlockType} BlockType */
/** @typedef {import('./embeddings/EmbeddingProvider').EmbeddingProvider} EmbeddingProvider */

/** @typedef {'fetching'|'chunking'|'embedding'|'scoring'|'aggregating'} PipelineStage */

/**
 * @typedef {import('../utils/vectorMath').ChunkingOptions & { strategy?: import('../types/models').ChunkingStrategy }} PipelineChunkingOptions
 */

/**
 * A chunk opens with a heading when its first line is a markdown heading, or a
 * heading-like line (see parseHeadingLine) followed by a blank line.
 * @param {string} text
 * @returns {{ heading: string|null, blockType: BlockType }}
 */
export function detectHeading(text) {
  const lines = text.split(/\r?\n/)
  const parsed = parseHeadingLine(lines[0])
  const followedByBlankLine = lines.length > 2 && lines[1].trim() === ''
  if (parsed && (parsed.isMarkdown || followedByBlankLine)) {
    return { heading: parsed.heading, blockType: parsed.blockType }
  }
  return { heading: null, blockType: 'paragraph' }
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
 * Layout chunking embeds whole chunks; semantic chunking embeds sentences,
 * groups them where the meaning shifts and averages each group's vectors.
 *
 * @param {Object} input
 * @param {string} input.keyword
 * @param {string} input.sourceText
 * @param {{ type: 'url'|'text', value: string }} input.inputSource
 * @param {import('../types/models').AnalysisMeta} [input.meta]
 * @param {{ contentScope: import('../types/models').ContentScope, sectionHeading: string|null }} [input.scope]
 *   How `sourceText` was selected; recorded on the result.
 * @param {CompetitorInput[]} [input.competitors]
 * @param {EmbeddingProvider} input.provider
 * @param {PipelineChunkingOptions} [input.chunking]
 * @param {(stage: PipelineStage) => void | Promise<void>} [input.onStage]
 * @returns {Promise<AnalysisResult>}
 */
export async function analyzeContent({
  keyword,
  sourceText,
  inputSource,
  meta = { targetAudience: '', contentPurpose: '', websiteNiche: '' },
  scope = { contentScope: 'complete_article', sectionHeading: null },
  competitors = [],
  provider,
  chunking = {},
  onStage,
}) {
  const targetKeyword = keyword?.trim()
  if (!targetKeyword) throw new Error('Target keyword is required.')
  const strategy = chunking.strategy ?? 'layout'

  await onStage?.('chunking')
  const units =
    strategy === 'semantic' ? splitSentences(sourceText ?? '', chunking) : chunkText(sourceText ?? '', chunking)
  if (units.length === 0) throw new Error('The source content is empty — there is nothing to analyze.')

  const competitorPages = competitors
    .flatMap((site) => site.pages.map((page) => ({ site, page, chunks: chunkText(page.text ?? '', chunking) })))
    .filter((entry) => entry.chunks.length > 0)

  await onStage?.('embedding')
  const texts = [
    targetKeyword,
    ...units.map((unit) => unit.text),
    ...competitorPages.flatMap((entry) => entry.chunks.map((chunk) => chunk.text)),
  ]
  const vectors = await provider.embed(texts)
  if (vectors.length !== texts.length) {
    throw new Error(`Embedding provider returned ${vectors.length} vectors for ${texts.length} texts.`)
  }

  await onStage?.('scoring')
  const keywordEmbedding = vectors[0]
  let cursor = 1
  const takeVectors = (count) => {
    const taken = vectors.slice(cursor, cursor + count)
    cursor += count
    return taken
  }

  const unitVectors = takeVectors(units.length)
  let rawChunks = units
  let chunkVectors = unitVectors
  if (strategy === 'semantic') {
    const grouped = semanticChunks(sourceText, units, unitVectors, chunking)
    rawChunks = grouped.chunks
    chunkVectors = grouped.embeddings
  }
  const chunks = scoreChunks(rawChunks, chunkVectors, keywordEmbedding)
  const embeddedCompetitorPages = competitorPages.map((entry) => ({
    ...entry,
    embeddings: takeVectors(entry.chunks.length),
  }))

  await onStage?.('aggregating')
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

  const result = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    targetKeyword,
    keywordEmbedding,
    inputSource,
    meta,
    options: { ...scope, chunkingStrategy: strategy },
    sourceText,
    chunks,
    summary: summarizeChunks(chunks),
    targetPage,
    competitors: competitorSites,
    deepAnalysis: null,
    embeddingMode: provider.id,
  }

  // Generate deep analysis
  if (provider.id === 'mock') {
    result.deepAnalysis = generateMockDeepAnalysis(result)
  }
  // Note: Real LLM integration (generateLLMDeepAnalysis) is a placeholder for future implementation

  return result
}
