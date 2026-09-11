import { createMockEmbeddingProvider } from './mockEmbeddingProvider'
import { createOpenAIEmbeddingProvider } from './openaiEmbeddingProvider'
import { createTransformersEmbeddingProvider } from './transformersEmbeddingProvider'

/** @typedef {'mock'|'transformers'|'openai'} EmbeddingMode */

/**
 * Contract shared by every embedding backend. `embed` returns one vector per
 * input text, in input order; vectors from one provider share a dimension.
 * Failures (missing key, network, model load) reject with a readable Error.
 *
 * @typedef {Object} EmbeddingProvider
 * @property {EmbeddingMode} id
 * @property {string} label
 * @property {(texts: string[]) => Promise<number[][]>} embed
 */

/**
 * @param {{ mode: EmbeddingMode, openaiApiKey?: string | null }} settings
 * @returns {EmbeddingProvider}
 */
export function createEmbeddingProvider({ mode, openaiApiKey = null }) {
  switch (mode) {
    case 'mock':
      return createMockEmbeddingProvider()
    case 'transformers':
      return createTransformersEmbeddingProvider()
    case 'openai':
      return createOpenAIEmbeddingProvider({ apiKey: openaiApiKey })
    default:
      throw new Error(`Unknown embedding mode: ${mode}`)
  }
}
