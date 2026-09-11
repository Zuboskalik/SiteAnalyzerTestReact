/** @typedef {'highly_relevant'|'broad_match'|'noise'} RelevanceZone */

// Percent thresholds from docs/spec.md §3.4: Highly Relevant >65%, Broad Match 43–64%, Noise 0–42%.
// Fractional values between the published bands (e.g. 64.5%, 42.5%) fall into the lower band.
export const HIGHLY_RELEVANT_ABOVE = 65
export const BROAD_MATCH_FROM = 43

/** @type {Record<RelevanceZone, { label: string, range: string, color: string, tint: string }>} */
export const RELEVANCE_ZONES = {
  highly_relevant: { label: 'Highly Relevant', range: '>65%', color: '#10b981', tint: '#ecfdf5' },
  broad_match: { label: 'Broad Match', range: '43–64%', color: '#f59e0b', tint: '#fffbeb' },
  noise: { label: 'Noise', range: '0–42%', color: '#f43f5e', tint: '#fff1f2' },
}

/**
 * @param {number} similarity Cosine similarity as a ratio (0–1); negative values count as noise.
 * @returns {RelevanceZone}
 */
export function classifyRelevanceZone(similarity) {
  const percent = similarity * 100
  if (percent > HIGHLY_RELEVANT_ABOVE) return 'highly_relevant'
  if (percent >= BROAD_MATCH_FROM) return 'broad_match'
  return 'noise'
}
