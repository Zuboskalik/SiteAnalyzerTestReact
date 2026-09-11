/**
 * Vector math utilities: cosine similarity between embeddings and splitting
 * raw text into semantic chunks for per-chunk relevance analysis.
 */

/**
 * Computes the cosine similarity between two equal-length numeric vectors.
 * Returns a value in [-1, 1]; 1 means identical direction, 0 means orthogonal.
 * Returns 0 for a zero-magnitude vector (undefined direction) instead of NaN.
 *
 * @param {number[]} vectorA
 * @param {number[]} vectorB
 * @returns {number}
 */
export function cosineSimilarity(vectorA, vectorB) {
  if (!Array.isArray(vectorA) || !Array.isArray(vectorB)) {
    throw new TypeError('cosineSimilarity: both arguments must be arrays')
  }
  if (vectorA.length !== vectorB.length) {
    throw new Error('cosineSimilarity: vectors must have the same length')
  }

  let dotProduct = 0
  let magnitudeA = 0
  let magnitudeB = 0

  for (let i = 0; i < vectorA.length; i++) {
    dotProduct += vectorA[i] * vectorB[i]
    magnitudeA += vectorA[i] * vectorA[i]
    magnitudeB += vectorB[i] * vectorB[i]
  }

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0
  }

  return dotProduct / (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB))
}

const DEFAULT_CHUNKING_OPTIONS = {
  // Chunks longer than this (in characters) are split further at sentence boundaries.
  maxChunkLength: 400,
  // Sentence-level fragments shorter than this are merged into a neighboring chunk.
  minChunkLength: 40,
}

const BLANK_LINE_REGEX = /\n{2,}/g
const SENTENCE_BOUNDARY_REGEX = /[.!?]+[")\]']?\s+/g

/**
 * Trims whitespace from a [start, end) span of `text` without changing the
 * substring's content, returning adjusted offsets that still satisfy
 * `text.slice(start, end) === text.slice(start, end).trim()`.
 * @param {string} text
 * @param {number} start
 * @param {number} end
 * @returns {{ start: number, end: number }}
 */
function trimSpan(text, start, end) {
  while (start < end && /\s/.test(text[start])) start++
  while (end > start && /\s/.test(text[end - 1])) end--
  return { start, end }
}

/**
 * Splits `text` into paragraph spans separated by one or more blank lines,
 * preserving exact character offsets into the original string.
 * @param {string} text
 * @returns {{ start: number, end: number }[]}
 */
function splitIntoParagraphSpans(text) {
  const spans = []
  let cursor = 0
  let match

  BLANK_LINE_REGEX.lastIndex = 0
  while ((match = BLANK_LINE_REGEX.exec(text)) !== null) {
    spans.push(trimSpan(text, cursor, match.index))
    cursor = match.index + match[0].length
  }
  spans.push(trimSpan(text, cursor, text.length))

  return spans.filter(({ start, end }) => end > start)
}

/**
 * Splits a single paragraph span into sentence-boundary spans, then greedily
 * regroups consecutive sentences into chunks close to `maxChunkLength`
 * without exceeding it (unless a single sentence is already longer).
 * @param {string} text
 * @param {{ start: number, end: number }} paragraphSpan
 * @param {{ maxChunkLength: number, minChunkLength: number }} options
 * @returns {{ start: number, end: number }[]}
 */
function splitParagraphIntoChunkSpans(text, paragraphSpan, options) {
  const { start: paragraphStart, end: paragraphEnd } = paragraphSpan
  const paragraphText = text.slice(paragraphStart, paragraphEnd)

  if (paragraphText.length <= options.maxChunkLength) {
    return [paragraphSpan]
  }

  // Locate sentence-ending boundaries within the paragraph, converting local
  // match offsets back into absolute offsets into the original `text`.
  const sentenceSpans = []
  let cursor = paragraphStart
  let match

  SENTENCE_BOUNDARY_REGEX.lastIndex = 0
  while ((match = SENTENCE_BOUNDARY_REGEX.exec(paragraphText)) !== null) {
    const boundaryEnd = paragraphStart + match.index + match[0].length
    sentenceSpans.push(trimSpan(text, cursor, boundaryEnd))
    cursor = boundaryEnd
  }
  if (cursor < paragraphEnd) {
    sentenceSpans.push(trimSpan(text, cursor, paragraphEnd))
  }

  // Greedily accumulate sentences into chunks, merging any trailing
  // fragment shorter than minChunkLength into the previous chunk.
  const chunkSpans = []
  let groupStart = null
  let groupEnd = null

  for (const sentence of sentenceSpans) {
    if (sentence.end <= sentence.start) continue

    if (groupStart === null) {
      groupStart = sentence.start
      groupEnd = sentence.end
      continue
    }

    const wouldBeLength = sentence.end - groupStart
    if (wouldBeLength > options.maxChunkLength) {
      chunkSpans.push({ start: groupStart, end: groupEnd })
      groupStart = sentence.start
      groupEnd = sentence.end
    } else {
      groupEnd = sentence.end
    }
  }
  if (groupStart !== null) {
    chunkSpans.push({ start: groupStart, end: groupEnd })
  }

  // Merge an undersized final chunk into its predecessor, when there is one.
  if (chunkSpans.length > 1) {
    const last = chunkSpans[chunkSpans.length - 1]
    if (last.end - last.start < options.minChunkLength) {
      chunkSpans.pop()
      chunkSpans[chunkSpans.length - 1].end = last.end
    }
  }

  return chunkSpans
}

/**
 * Splits raw text into semantic chunks for embedding/relevance analysis.
 * Chunking strategy: split on blank lines (paragraphs) first; any paragraph
 * longer than `maxChunkLength` is further split at sentence boundaries and
 * regrouped into chunks close to `maxChunkLength`. Every returned chunk
 * satisfies `text.slice(charStart, charEnd) === chunk.text`.
 *
 * @param {string} text
 * @param {{ maxChunkLength?: number, minChunkLength?: number }} [options]
 * @returns {{ text: string, index: number, charStart: number, charEnd: number }[]}
 */
export function chunkText(text, options = {}) {
  if (typeof text !== 'string') {
    throw new TypeError('chunkText: text must be a string')
  }

  const resolvedOptions = { ...DEFAULT_CHUNKING_OPTIONS, ...options }

  if (text.trim().length === 0) {
    return []
  }

  const paragraphSpans = splitIntoParagraphSpans(text)
  const chunkSpans = paragraphSpans.flatMap((paragraphSpan) =>
    splitParagraphIntoChunkSpans(text, paragraphSpan, resolvedOptions),
  )

  return chunkSpans.map(({ start, end }, index) => ({
    text: text.slice(start, end),
    index,
    charStart: start,
    charEnd: end,
  }))
}
