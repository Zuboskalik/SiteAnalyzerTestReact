import { forceCollide, forceRadial, forceSimulation } from 'd3'
import { cosineSimilarity, normalizeVector } from './vectorMath'

/**
 * @typedef {Object} RadialPoint
 * @property {number} x           Relative to the keyword at (0, 0).
 * @property {number} y
 * @property {number} similarity  Cosine similarity to the keyword.
 * @property {number} distance    1 − similarity, clamped to [0, 1].
 */

const dot = (a, b) => {
  let sum = 0
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i]
  return sum
}

/** Linear congruential generator, so the force pass is deterministic. */
function seededRandom(seed = 1) {
  let state = seed
  return () => {
    state = (1664525 * state + 1013904223) % 4294967296
    return state / 4294967296
  }
}

/** Dominant direction of the (centred) rows, by power iteration from a fixed start. */
function principalAxis(rows, dims) {
  let axis = normalizeVector(Array.from({ length: dims }, (_, i) => Math.sin(i + 1)))
  for (let iteration = 0; iteration < 50; iteration++) {
    const next = new Array(dims).fill(0)
    for (const row of rows) {
      const projection = dot(row, axis)
      for (let i = 0; i < dims; i++) next[i] += projection * row[i]
    }
    const length = Math.sqrt(dot(next, next))
    if (length < 1e-12) return null
    axis = next.map((value) => value / length)
  }
  return axis
}

/**
 * Angles from a 2-D PCA of what remains of each vector once the keyword
 * direction is removed, so items about related sub-topics sit side by side.
 */
function spreadAngles(vectors, keywordEmbedding) {
  const keyword = normalizeVector(keywordEmbedding)
  const dims = keyword.length
  const residuals = vectors.map((vector) => {
    const unit = normalizeVector(vector)
    const along = dot(unit, keyword)
    return unit.map((value, i) => value - along * keyword[i])
  })

  const centre = new Array(dims).fill(0)
  for (const residual of residuals) {
    for (let i = 0; i < dims; i++) centre[i] += residual[i] / residuals.length
  }
  const centred = residuals.map((residual) => residual.map((value, i) => value - centre[i]))

  const first = principalAxis(centred, dims)
  if (!first) return vectors.map((_, i) => (2 * Math.PI * i) / vectors.length)
  const deflated = centred.map((row) => {
    const projection = dot(row, first)
    return row.map((value, i) => value - projection * first[i])
  })
  const second = principalAxis(deflated, dims)
  return centred.map((row) => Math.atan2(second ? dot(row, second) : 0, dot(row, first)))
}

/**
 * Places vectors around a keyword at the centre: the distance from the centre is
 * proportional to 1 − cosine similarity, so the most relevant items sit closest.
 *
 * @param {number[][]} vectors
 * @param {number[]} keywordEmbedding
 * @param {{ radius: number, maxDistance?: number, markerRadius?: number }} options
 *   `maxDistance` is the 1 − cos value drawn at `radius` (default 1); farther items are clamped to the edge.
 * @returns {RadialPoint[]}
 */
export function radialLayout(vectors, keywordEmbedding, { radius, maxDistance = 1, markerRadius = 6 }) {
  if (vectors.length === 0) return []

  const angles = spreadAngles(vectors, keywordEmbedding)
  const nodes = vectors.map((vector, i) => {
    const similarity = cosineSimilarity(vector, keywordEmbedding)
    const distance = Math.min(1, Math.max(0, 1 - similarity))
    const r = Math.min(1, distance / maxDistance) * radius
    return { similarity, distance, r, x: r * Math.cos(angles[i]), y: r * Math.sin(angles[i]) }
  })

  // Nudge overlapping markers apart, then snap each back onto its exact radius so distance stays truthful.
  forceSimulation(nodes)
    .randomSource(seededRandom())
    .force('radial', forceRadial((node) => node.r).strength(0.9))
    .force('collide', forceCollide(markerRadius + 1.5))
    .stop()
    .tick(120)

  return nodes.map(({ x, y, r, similarity, distance }) => {
    const angle = Math.atan2(y, x)
    return { x: r * Math.cos(angle), y: r * Math.sin(angle), similarity, distance }
  })
}
