/** @typedef {import('../types/models').AnalysisResult} AnalysisResult */
/** @typedef {import('../types/models').ComparisonMap} ComparisonMap */

export const TARGET_SITE_COLOR = '#5cbf8a'

/**
 * Comparison Map input for a single-page analysis: the analyzed page as the
 * target site plus every competitor site, in the same shape as `mockComparisonMap`.
 * @param {AnalysisResult} result
 * @returns {ComparisonMap}
 */
export function comparisonMapFromAnalysis(result) {
  const targetUrl = result.targetPage.url ? new URL(result.targetPage.url) : null
  return {
    keyword: { id: 'keyword', text: result.targetKeyword, embedding: result.keywordEmbedding },
    sites: [
      {
        id: 'site-target',
        role: 'target',
        name: targetUrl?.hostname ?? 'Your content',
        url: targetUrl?.origin ?? '',
        color: TARGET_SITE_COLOR,
        pages: [result.targetPage],
      },
      ...result.competitors.map((site) => ({ ...site, role: 'competitor' })),
    ],
    clusters: [],
  }
}

/**
 * Pages whose Tether (cosine similarity to the keyword) reaches `threshold`.
 * @param {ComparisonMap} map
 * @param {number} threshold Similarity ratio (0–1).
 * @returns {{ total: number, perSite: Record<string, number>, bestSimilarity: number }}
 */
export function tetherStats(map, threshold) {
  const perSite = {}
  let total = 0
  let bestSimilarity = 0
  for (const site of map.sites) {
    perSite[site.id] = site.pages.filter((page) => page.similarityToKeyword >= threshold).length
    total += perSite[site.id]
    for (const page of site.pages) bestSimilarity = Math.max(bestSimilarity, page.similarityToKeyword)
  }
  return { total, perSite, bestSimilarity }
}
