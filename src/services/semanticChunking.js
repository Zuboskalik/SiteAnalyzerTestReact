import { parseHeadingLine } from '../utils/headings'
import { cosineSimilarity, meanVector } from '../utils/vectorMath'

// Break where the meaning shifts most: adjacent-sentence distances in the top quarter.
const BREAKPOINT_QUANTILE = 0.75

function quantile(values, q) {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]
}

const groupLength = (units, group) => units[group.at(-1)].charEnd - units[group[0]].charStart

/**
 * Groups consecutive sentence units into chunks. A new chunk starts where the
 * distance between neighbouring sentences is among the largest, or where the
 * chunk would outgrow `maxChunkLength`. A heading never ends a chunk, and
 * chunks shorter than `minChunkLength` are folded into a neighbour.
 *
 * @param {string} text Source text the unit offsets point into.
 * @param {{ text: string, charStart: number, charEnd: number }[]} units
 * @param {number[][]} vectors One embedding per unit.
 * @param {{ maxChunkLength?: number, minChunkLength?: number }} [options]
 * @returns {{ chunks: { text: string, index: number, charStart: number, charEnd: number }[], embeddings: number[][] }}
 */
export function semanticChunks(text, units, vectors, { maxChunkLength = 600, minChunkLength = 80 } = {}) {
  if (units.length === 0) return { chunks: [], embeddings: [] }

  const distances = units.slice(1).map((_, i) => 1 - cosineSimilarity(vectors[i], vectors[i + 1]))
  const threshold = distances.length > 0 ? quantile(distances, BREAKPOINT_QUANTILE) : Infinity
  const minDistance = Math.min(...distances)

  const groups = [[0]]
  for (let i = 1; i < units.length; i++) {
    const current = groups.at(-1)
    const afterHeading = parseHeadingLine(units[i - 1].text) !== null
    // Strictly above the minimum, so uniformly similar text never splits on meaning alone.
    const meaningShift = distances[i - 1] >= threshold && distances[i - 1] > minDistance
    const tooLong = units[i].charEnd - units[current[0]].charStart > maxChunkLength
    if (!afterHeading && (meaningShift || tooLong)) groups.push([i])
    else current.push(i)
  }

  const merged = []
  for (const group of groups) {
    const previous = merged.at(-1)
    if (previous && groupLength(units, previous) < minChunkLength) previous.push(...group)
    else merged.push([...group])
  }
  if (merged.length > 1 && groupLength(units, merged.at(-1)) < minChunkLength) {
    merged.at(-2).push(...merged.pop())
  }

  return {
    chunks: merged.map((group, index) => {
      const charStart = units[group[0]].charStart
      const charEnd = units[group.at(-1)].charEnd
      return { text: text.slice(charStart, charEnd), index, charStart, charEnd }
    }),
    embeddings: merged.map((group) => meanVector(group.map((i) => vectors[i]))),
  }
}
