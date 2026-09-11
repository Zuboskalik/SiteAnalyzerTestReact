import { mockAnalysisFormDefaults, mockAnalysisResult } from '../mocks/semanticData'
import { extractSection } from '../utils/contentScope'
import { analyzeContent } from './analysisPipeline'
import { createEmbeddingProvider } from './embeddings/EmbeddingProvider'
import { fetchPageText } from './pageFetcher'

/** @typedef {import('../types/models').AnalysisResult} AnalysisResult */
/** @typedef {import('../types/models').EmbeddingMode} EmbeddingMode */
/** @typedef {import('./analysisPipeline').PipelineStage} PipelineStage */

/**
 * Validated form payload (see buildAnalysisRequest).
 * @typedef {Object} AnalysisRequest
 * @property {string} keyword
 * @property {'url'|'text'} sourceType
 * @property {string} url                  '' for the Text source.
 * @property {string} text                 '' for the URL source.
 * @property {string} [fetchedText]        Page text already loaded with the form's Fetch button.
 * @property {import('../types/models').AnalysisMeta} meta
 * @property {import('../types/models').ContentScope} contentScope
 * @property {string} sectionHeading       '' unless contentScope is 'specific_section'.
 * @property {import('../types/models').ChunkingStrategy} chunkingStrategy
 * @property {string[]} competitorUrls     Trimmed, non-empty.
 */

/** @type {{ id: PipelineStage, label: string }[]} */
export const ANALYSIS_STAGES = [
  { id: 'fetching', label: 'Fetching content' },
  { id: 'chunking', label: 'Breaking into chunks' },
  { id: 'embedding', label: 'Generating embeddings' },
  { id: 'scoring', label: 'Calculating relevance scores' },
  { id: 'aggregating', label: 'Aggregating results' },
]

const DEMO_STAGE_DELAY_MS = 450
const COMPETITOR_COLORS = ['#7c6fe0', '#f59e0b', '#0ea5e9', '#ef4444', '#14b8a6']

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const sameKeyword = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase()

/** The reference scenario returns the curated demo result, so demo mode reproduces the reference scores exactly. */
function isReferenceScenario(request) {
  return (
    request.sourceType === 'url' &&
    request.url === mockAnalysisFormDefaults.url &&
    sameKeyword(request.keyword, mockAnalysisFormDefaults.keyword) &&
    request.contentScope === 'complete_article' &&
    request.chunkingStrategy === 'layout'
  )
}

function pageTopic(url) {
  const { hostname, pathname } = new URL(url)
  const slug = pathname.split('/').filter(Boolean).at(-1)
  return slug ? slug.replace(/\.\w+$/, '').replace(/[-_]+/g, ' ') : hostname
}

/** Demo mode never touches the network: competitor pages get placeholder text derived from their URL. */
function simulatedPageText(url) {
  const topic = pageTopic(url)
  return `${topic}\n\nDemo mode does not download ${url}; this placeholder stands in for a page about ${topic}, so its vectors reflect the topic in the URL.`
}

/**
 * @param {Pick<AnalysisRequest, 'sourceType'|'url'|'text'|'fetchedText'>} request
 * @param {EmbeddingMode} mode Demo mode loads the sample article for any URL.
 * @returns {Promise<string>}
 */
export async function loadSourceText(request, mode) {
  if (request.sourceType === 'text') return request.text
  if (request.fetchedText) return request.fetchedText
  if (mode === 'mock') return mockAnalysisResult.sourceText
  return fetchPageText(request.url)
}

async function loadCompetitors(urls, mode) {
  const pages = await Promise.all(
    urls.map(async (url) => ({ url, text: mode === 'mock' ? simulatedPageText(url) : await fetchPageText(url) })),
  )

  const sites = new Map()
  for (const page of pages) {
    const { hostname, origin } = new URL(page.url)
    if (!sites.has(hostname)) {
      sites.set(hostname, {
        id: `competitor-${hostname}`,
        name: hostname,
        url: origin,
        color: COMPETITOR_COLORS[sites.size % COMPETITOR_COLORS.length],
        pages: [],
      })
    }
    const site = sites.get(hostname)
    site.pages.push({ id: `${site.id}-page-${site.pages.length + 1}`, url: page.url, label: pageTopic(page.url), text: page.text })
  }
  return [...sites.values()]
}

/**
 * Fetch → (section) → chunk → embed → score. Demo mode paces the stages so the
 * progress checklist stays readable; real modes report stages as they happen.
 *
 * @param {AnalysisRequest} request
 * @param {{ mode: EmbeddingMode, openaiApiKey?: string|null, onStage?: (stage: PipelineStage) => void, stageDelayMs?: number }} options
 * @returns {Promise<AnalysisResult>}
 */
export async function runAnalysisRequest(
  request,
  { mode, openaiApiKey = null, onStage, stageDelayMs = DEMO_STAGE_DELAY_MS },
) {
  const reportStage = async (stage) => {
    onStage?.(stage)
    if (mode === 'mock' && stageDelayMs > 0) await sleep(stageDelayMs)
  }
  const scope = {
    contentScope: request.contentScope,
    sectionHeading: request.contentScope === 'specific_section' ? request.sectionHeading : null,
  }

  await reportStage('fetching')
  if (mode === 'mock' && isReferenceScenario(request)) {
    for (const stage of ['chunking', 'embedding', 'scoring', 'aggregating']) await reportStage(stage)
    return {
      ...mockAnalysisResult,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      meta: request.meta,
      options: { ...scope, chunkingStrategy: 'layout' },
    }
  }

  const [fullText, competitors] = await Promise.all([
    loadSourceText(request, mode),
    loadCompetitors(request.competitorUrls, mode),
  ])
  const sourceText = scope.sectionHeading ? extractSection(fullText, scope.sectionHeading) : fullText

  return analyzeContent({
    keyword: request.keyword,
    sourceText,
    inputSource: request.sourceType === 'url' ? { type: 'url', value: request.url } : { type: 'text', value: '' },
    meta: request.meta,
    scope,
    competitors,
    provider: createEmbeddingProvider({ mode, openaiApiKey }),
    chunking: { strategy: request.chunkingStrategy },
    onStage: reportStage,
  })
}
