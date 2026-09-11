/**
 * Demo / mock data for the Semantic Relevance & Space Analyzer.
 *
 * Reproduces the data shape behind the Comparison Map visualization (Target
 * Keyword as a gold diamond, target-site and competitor-site pages as
 * colored points connected to the keyword by Tether lines whose strength is
 * the page's cosine similarity to the keyword, filterable by a Tether
 * threshold), together with a chunk-level breakdown of one representative
 * target page for the Relevance Dashboard / Proximity Map visualizations.
 *
 * Field names follow the PageVector / CompetitorSite / Chunk shapes
 * documented in docs/plan.md so this data can be swapped for a real
 * EmbeddingProvider-backed AnalysisResult later without reshaping consumers.
 *
 * The embeddings below are synthetic (no real embedding model involved):
 * each one is constructed so that `cosineSimilarity(embedding, keywordEmbedding)`
 * reproduces the curated similarity value it is paired with, using the
 * `cosineSimilarity` function from `src/utils/vectorMath.js` itself — so the
 * demo dataset is internally consistent with the app's own math module.
 */
import { chunkText, cosineSimilarity } from '../utils/vectorMath'

const EMBEDDING_DIMENSIONS = 32

/** Deterministic PRNG (mulberry32) so the demo dataset is stable across reloads. */
function createRng(seedString) {
  let seed = 0
  for (let i = 0; i < seedString.length; i++) {
    seed = (seed * 31 + seedString.charCodeAt(i)) >>> 0
  }
  return function rng() {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function normalize(vector) {
  const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0))
  if (magnitude === 0) return vector
  return vector.map((v) => v / magnitude)
}

function randomUnitVector(dimensions, rng) {
  const vector = Array.from({ length: dimensions }, () => rng() * 2 - 1)
  return normalize(vector)
}

/**
 * Builds a unit embedding whose cosine similarity to `baseVector` is (up to
 * floating-point rounding) exactly `targetSimilarity`, by blending
 * `baseVector` with a random vector orthogonal to it.
 */
function embeddingWithSimilarity(baseVector, targetSimilarity, rng) {
  const random = randomUnitVector(baseVector.length, rng)
  const projection = random.reduce((sum, v, i) => sum + v * baseVector[i], 0)
  const orthogonal = normalize(
    random.map((v, i) => v - projection * baseVector[i]),
  )
  const s = Math.max(-1, Math.min(1, targetSimilarity))
  const orthogonalWeight = Math.sqrt(Math.max(0, 1 - s * s))
  return baseVector.map((b, i) => s * b + orthogonalWeight * orthogonal[i])
}

/** Mirrors the Highly Relevant / Broad Match / Noise thresholds from docs/spec.md 3.4. */
function classifyRelevanceZone(similarity) {
  if (similarity > 0.65) return 'highly_relevant'
  if (similarity >= 0.43) return 'broad_match'
  return 'noise'
}

const rng = createRng('semantic-relevance-space-analyzer-demo')

// ---------------------------------------------------------------------------
// Target Keyword — rendered as the gold diamond at the center of the maps
// ---------------------------------------------------------------------------

const keywordEmbedding = randomUnitVector(EMBEDDING_DIMENSIONS, rng)

export const mockTargetKeyword = {
  id: 'keyword-personal-injury-lawyer',
  label: 'personal injury lawyer',
  embedding: keywordEmbedding,
  meta: {
    targetAudience:
      'People seeking legal representation after an accident or injury',
    contentPurpose: 'commercial',
    websiteNiche: 'Personal injury / legal services',
  },
}

/** Builds a PageVector-shaped mock entry with an internally-consistent embedding. */
function buildPage({ id, url, label, type, competitorId = null, similarity }) {
  const embedding = embeddingWithSimilarity(keywordEmbedding, similarity, rng)
  const similarityToKeyword = cosineSimilarity(embedding, keywordEmbedding)
  return {
    id,
    url,
    label,
    type,
    competitorId,
    embedding,
    similarityToKeyword,
    // 0-10 scale, matching the "Tether ≥ 7.5" / "best 8.1/10" display convention.
    tetherScore: Math.round(similarityToKeyword * 1000) / 100,
  }
}

// ---------------------------------------------------------------------------
// Target site — the analyzed site's pages (green points on the Comparison Map)
// ---------------------------------------------------------------------------

const TARGET_SITE_PAGES = [
  ['What to Do After a Car Accident: Step-by-Step Guide', 0.88],
  ['How Much Is My Personal Injury Claim Worth?', 0.84],
  ['Free Consultation With a Personal Injury Lawyer', 0.81],
  ['Slip and Fall Accident Claims Explained', 0.78],
  ['Truck Accident Lawsuit Timeline', 0.74],
  ['Motorcycle Accident Injury Attorney', 0.71],
  ['Understanding Comparative Negligence Laws', 0.68],
  ["Wrongful Death Claims: A Family's Guide", 0.63],
  ['Medical Malpractice Lawsuit Process', 0.58],
  ['Dog Bite Injury Compensation', 0.52],
  ['Client Testimonials and Case Results', 0.39],
  ['About Our Personal Injury Practice', 0.34],
  ['Contact Our Injury Law Firm', 0.27],
]

export const mockTargetSite = {
  id: 'site-target',
  name: 'yourfirm.com',
  url: 'https://yourfirm.com',
  color: '#22c55e',
  type: 'target',
  pages: TARGET_SITE_PAGES.map(([label, similarity], i) =>
    buildPage({
      id: `target-page-${i + 1}`,
      url: `https://yourfirm.com/${label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`,
      label,
      type: 'target',
      similarity,
    }),
  ),
}

// ---------------------------------------------------------------------------
// Competitor site — a rival full-service firm (purple points on the map)
// ---------------------------------------------------------------------------

const COMPETITOR_PAGES = [
  ['Personal Injury Attorneys You Can Trust', 0.86],
  ['Car Accident Compensation Claims', 0.82],
  ["Workplace Injury and Workers' Comp Lawyer", 0.76],
  ['Bicycle Accident Injury Claims', 0.72],
  ['Nursing Home Abuse Attorney', 0.69],
  ['Product Liability Lawsuit Help', 0.65],
  ['Insurance Claim Denial Appeals', 0.6],
  ['Case Results', 0.44],
  ['Divorce and Family Law Services', 0.41],
  ['Our Attorneys', 0.37],
  ['Criminal Defense Representation', 0.35],
  ['Estate Planning and Wills', 0.31],
  ['Business Litigation Attorneys', 0.29],
  ['Contact Citywide Legal Group', 0.25],
]

export const mockCompetitorSites = [
  {
    id: 'competitor-citywide-legal',
    name: 'Citywide Legal Group',
    url: 'https://citywidelegalgroup.com',
    color: '#6366f1',
    pages: COMPETITOR_PAGES.map(([label, similarity], i) =>
      buildPage({
        id: `competitor-1-page-${i + 1}`,
        url: `https://citywidelegalgroup.com/${label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`,
        label,
        type: 'competitor',
        competitorId: 'competitor-citywide-legal',
        similarity,
      }),
    ),
  },
]

// ---------------------------------------------------------------------------
// Comparison Map UI defaults + derived stats (mirrors the reference
// screenshot's "N pages ≥ threshold · best X/10" summary line)
// ---------------------------------------------------------------------------

export const mockComparisonMapSettings = {
  tetherThreshold: 0.75,
}

export function getComparisonMapStats(
  threshold = mockComparisonMapSettings.tetherThreshold,
) {
  const allPages = [
    ...mockTargetSite.pages,
    ...mockCompetitorSites.flatMap((site) => site.pages),
  ]
  const pagesAboveThreshold = allPages.filter(
    (page) => page.similarityToKeyword >= threshold,
  ).length
  const bestSimilarity = allPages.reduce(
    (max, page) => Math.max(max, page.similarityToKeyword),
    0,
  )
  return {
    totalPages: allPages.length,
    pagesAboveThreshold,
    bestSimilarity,
    bestTetherScore: Math.round(bestSimilarity * 1000) / 100,
  }
}

// ---------------------------------------------------------------------------
// Chunk-level breakdown of one target page, for the Relevance Dashboard /
// Semantic Proximity Map. Each paragraph below is written to stay under the
// default chunkText() maxChunkLength (400 chars), so chunking is 1:1 with
// paragraphs and lines up with the curated PARAGRAPH_SIMILARITIES below.
// ---------------------------------------------------------------------------

const ANALYZED_PAGE_TEXT = `Being involved in a car accident is disorienting, but the steps you take in the first few minutes can significantly affect your health, your insurance claim, and any personal injury case you may later file. This guide walks through what to do, in order.

First, check yourself and any passengers for injuries and call 911 if anyone needs medical attention. Move vehicles out of traffic only if it is safe to do so. Never admit fault at the scene, even casually, since statements can be used against you later.

Document everything you can: photograph vehicle damage, license plates, road conditions, and any visible injuries. Collect contact information from witnesses and the other driver. This evidence often determines how an insurance adjuster values your claim.

If you were injured, or if fault is disputed, it is worth a free consultation with a personal injury lawyer before speaking to the other driver's insurance company. An attorney can flag lowball offers and missed deadlines early.

Our firm was founded in 1998 by a former paralegal who wanted a more client-first practice. Today our office hosts a monthly community legal-aid clinic and sponsors a local youth soccer league, alongside our personal injury caseload.

Insurance companies often use recorded statements, fast settlement offers, and surveillance to minimize payouts. Understanding these tactics before you interact with an adjuster can prevent you from accidentally undermining your own claim.

If you have been in a car accident, keep this checklist handy and reach out for a free case review. Acting quickly preserves evidence and protects your right to full compensation for medical bills and lost wages.`

// One curated similarity per paragraph above, in order — deliberately includes
// an off-topic "firm history" tangent (paragraph 5) to demonstrate the Noise
// zone alongside Highly Relevant and Broad Match chunks.
const PARAGRAPH_SIMILARITIES = [0.87, 0.83, 0.79, 0.74, 0.28, 0.55, 0.63]

function buildAnalyzedPageChunks() {
  const rawChunks = chunkText(ANALYZED_PAGE_TEXT)
  return rawChunks.map((chunk, i) => {
    const targetSimilarity = PARAGRAPH_SIMILARITIES[i] ?? 0.5
    const embedding = embeddingWithSimilarity(keywordEmbedding, targetSimilarity, rng)
    const similarity = cosineSimilarity(embedding, keywordEmbedding)
    return {
      id: `analyzed-page-chunk-${i + 1}`,
      text: chunk.text,
      index: chunk.index,
      charStart: chunk.charStart,
      charEnd: chunk.charEnd,
      embedding,
      similarity,
      relevanceZone: classifyRelevanceZone(similarity),
    }
  })
}

export const mockAnalyzedPage = {
  id: 'target-page-1',
  url: mockTargetSite.pages[0].url,
  label: mockTargetSite.pages[0].label,
  text: ANALYZED_PAGE_TEXT,
  chunks: buildAnalyzedPageChunks(),
}

// ---------------------------------------------------------------------------
// Single convenience export bundling everything above
// ---------------------------------------------------------------------------

export const mockSemanticData = {
  targetKeyword: mockTargetKeyword,
  targetSite: mockTargetSite,
  competitorSites: mockCompetitorSites,
  comparisonMapSettings: mockComparisonMapSettings,
  analyzedPage: mockAnalyzedPage,
}
