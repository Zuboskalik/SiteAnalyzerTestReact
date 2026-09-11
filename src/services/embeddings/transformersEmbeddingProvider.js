export const DEFAULT_TRANSFORMERS_MODEL = 'onnx-community/all-MiniLM-L6-v2-ONNX'

/** One extractor per model for the whole session, so weights download and compile once. */
const extractorCache = new Map()

function loadExtractor(model, onProgress) {
  if (!extractorCache.has(model)) {
    const loading = import('@huggingface/transformers')
      .then(({ pipeline }) => pipeline('feature-extraction', model, { progress_callback: onProgress }))
      .catch((error) => {
        extractorCache.delete(model)
        throw new Error(`Failed to load local embedding model "${model}": ${error.message}`, { cause: error })
      })
    extractorCache.set(model, loading)
  }
  return extractorCache.get(model)
}

/**
 * Runs a sentence-embedding model fully in the browser (WASM/WebGPU); no API key needed.
 * @param {{ model?: string, onProgress?: (event: object) => void }} [options]
 * @returns {import('./EmbeddingProvider').EmbeddingProvider}
 */
export function createTransformersEmbeddingProvider({ model = DEFAULT_TRANSFORMERS_MODEL, onProgress } = {}) {
  return {
    id: 'transformers',
    label: 'Transformers.js (local)',
    async embed(texts) {
      if (texts.length === 0) return []
      const extractor = await loadExtractor(model, onProgress)
      const output = await extractor(texts, { pooling: 'mean', normalize: true })
      return output.tolist()
    },
  }
}
