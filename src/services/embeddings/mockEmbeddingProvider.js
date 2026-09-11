import { normalizeVector } from '../../utils/vectorMath'

const DIMENSIONS = 256

// Every mock vector gets this much weight on one shared axis, so unrelated
// texts land near ~45% similarity instead of ~0%. That spreads demo results
// across all three relevance zones the way real sentence embeddings do.
const SHARED_TOPIC_WEIGHT = 0.9

const STOP_WORDS = new Set(
  'a an and are as at be by can for from has have how in is it its of on or that the this to was what were will with you your'.split(
    ' ',
  ),
)

function fnv1a(input) {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

function tokenize(text) {
  return (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter((token) => !STOP_WORDS.has(token))
}

function addHashedFeature(vector, feature, weight) {
  const hash = fnv1a(feature)
  // Dimension 0 is reserved for the shared topic axis.
  const index = 1 + (hash % (DIMENSIONS - 1))
  vector[index] += hash & 0x80000000 ? -weight : weight
}

/**
 * Feature-hashed bag of words plus character trigrams (so "accountant" and
 * "accountancy" overlap). Deterministic: the same text always yields the same vector.
 */
function embedText(text) {
  const features = new Array(DIMENSIONS).fill(0)
  for (const token of tokenize(text)) {
    addHashedFeature(features, `w:${token}`, 1)
    for (let i = 0; i + 3 <= token.length; i++) {
      addHashedFeature(features, `t:${token.slice(i, i + 3)}`, 0.5)
    }
  }
  const textPart = normalizeVector(features)
  textPart[0] = SHARED_TOPIC_WEIGHT
  return normalizeVector(textPart)
}

/** @returns {import('./EmbeddingProvider').EmbeddingProvider} */
export function createMockEmbeddingProvider() {
  return {
    id: 'mock',
    label: 'Demo (mock vectors)',
    async embed(texts) {
      return texts.map(embedText)
    },
  }
}
