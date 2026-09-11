/**
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number} Cosine similarity in [-1, 1]; 0 when either vector has zero magnitude.
 */
export function cosineSimilarity(a, b) {
  if (a.length !== b.length) {
    throw new Error(`cosineSimilarity: vector length mismatch (${a.length} vs ${b.length})`)
  }

  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  if (normA === 0 || normB === 0) return 0

  // Clamp float drift so identical vectors report exactly 1.
  return Math.max(-1, Math.min(1, dot / Math.sqrt(normA * normB)))
}

/** @param {number[]} vector */
export function normalizeVector(vector) {
  const norm = Math.hypot(...vector)
  return norm === 0 ? vector.slice() : vector.map((v) => v / norm)
}

/**
 * Element-wise mean, used to aggregate chunk embeddings into a page-level vector.
 * @param {number[][]} vectors
 */
export function meanVector(vectors) {
  if (vectors.length === 0) throw new Error('meanVector: no vectors given')
  const sum = new Array(vectors[0].length).fill(0)
  for (const vector of vectors) {
    for (let i = 0; i < sum.length; i++) sum[i] += vector[i]
  }
  return sum.map((v) => v / vectors.length)
}

const PARAGRAPH_BREAK = /\n\s*\n/g
const SENTENCE_END = /[.!?…]+["'»)\]]*\s+/g
const WHITESPACE = /\s/

/**
 * @typedef {{ start: number, end: number }} Span
 */

function trimSpan(text, start, end) {
  while (start < end && WHITESPACE.test(text[start])) start++
  while (end > start && WHITESPACE.test(text[end - 1])) end--
  return { start, end }
}

const spanLength = (span) => span.end - span.start

function splitSpanAt(text, span, boundary) {
  const pieces = []
  let cursor = span.start
  for (const match of text.slice(span.start, span.end).matchAll(boundary)) {
    const cut = span.start + match.index + match[0].length
    pieces.push(trimSpan(text, cursor, cut))
    cursor = cut
  }
  pieces.push(trimSpan(text, cursor, span.end))
  return pieces.filter((piece) => spanLength(piece) > 0)
}

/** Last-resort split of a single over-long sentence at whitespace. */
function hardSplit(text, span, maxLength) {
  const pieces = []
  let start = span.start
  while (span.end - start > maxLength) {
    let cut = start + maxLength
    while (cut > start && !WHITESPACE.test(text[cut])) cut--
    if (cut === start) cut = start + maxLength
    pieces.push(trimSpan(text, start, cut))
    start = trimSpan(text, cut, span.end).start
  }
  pieces.push(trimSpan(text, start, span.end))
  return pieces.filter((piece) => spanLength(piece) > 0)
}

function packSpans(spans, maxLength) {
  const packed = []
  for (const span of spans) {
    const current = packed.at(-1)
    if (current && span.end - current.start <= maxLength) {
      current.end = span.end
    } else {
      packed.push({ ...span })
    }
  }
  return packed
}

function splitLongSpan(text, span, maxLength) {
  if (spanLength(span) <= maxLength) return [span]
  const sentences = splitSpanAt(text, span, SENTENCE_END).flatMap((sentence) =>
    spanLength(sentence) > maxLength ? hardSplit(text, sentence, maxLength) : [sentence],
  )
  return packSpans(sentences, maxLength)
}

/**
 * Short spans (headings, one-liners, sentence leftovers) carry too little
 * meaning to embed on their own, so each is folded into its neighbour:
 * a heading joins the paragraph after it, a trailing leftover joins the one before.
 */
function mergeShortSpans(spans, minLength) {
  const merged = []
  for (const span of spans) {
    const previous = merged.at(-1)
    if (previous && spanLength(previous) < minLength) {
      previous.end = span.end
    } else {
      merged.push({ ...span })
    }
  }
  if (merged.length > 1 && spanLength(merged.at(-1)) < minLength) {
    merged.at(-2).end = merged.pop().end
  }
  return merged
}

/**
 * @param {string} text
 * @returns {Span[]} Blank-line separated paragraphs, trimmed.
 */
export function splitParagraphs(text) {
  return splitSpanAt(text, { start: 0, end: text.length }, PARAGRAPH_BREAK)
}

/**
 * Sentence units for semantic chunking; a heading paragraph is a unit of its own.
 * @param {string} text
 * @param {{ maxSentenceLength?: number }} [options]
 * @returns {{ text: string, charStart: number, charEnd: number }[]}
 */
export function splitSentences(text, { maxSentenceLength = 600 } = {}) {
  return splitParagraphs(text)
    .flatMap((paragraph) => splitSpanAt(text, paragraph, SENTENCE_END))
    .flatMap((sentence) =>
      spanLength(sentence) > maxSentenceLength ? hardSplit(text, sentence, maxSentenceLength) : [sentence],
    )
    .map(({ start, end }) => ({ text: text.slice(start, end), charStart: start, charEnd: end }))
}

/**
 * @typedef {Object} ChunkingOptions
 * @property {number} [maxChunkLength=600] Paragraphs longer than this (chars) are split at sentence boundaries.
 * @property {number} [minChunkLength=80]  Spans shorter than this are merged into a neighbour.
 */

/**
 * Layout-based chunking: paragraphs (blank-line separated) are the primary
 * unit; long paragraphs are split by sentences, short ones merged. Every chunk
 * satisfies `text.slice(chunk.charStart, chunk.charEnd) === chunk.text`.
 *
 * @param {string} text
 * @param {ChunkingOptions} [options]
 * @returns {{ text: string, index: number, charStart: number, charEnd: number }[]}
 */
export function chunkText(text, { maxChunkLength = 600, minChunkLength = 80 } = {}) {
  if (typeof text !== 'string') throw new TypeError('chunkText: text must be a string')
  if (minChunkLength > maxChunkLength) {
    throw new RangeError('chunkText: minChunkLength must not exceed maxChunkLength')
  }

  const paragraphs = splitParagraphs(text)
  const spans = mergeShortSpans(
    paragraphs.flatMap((paragraph) => splitLongSpan(text, paragraph, maxChunkLength)),
    minChunkLength,
  )

  return spans.map(({ start, end }, index) => ({
    text: text.slice(start, end),
    index,
    charStart: start,
    charEnd: end,
  }))
}
