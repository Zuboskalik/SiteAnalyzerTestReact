const OPENAI_EMBEDDINGS_URL = 'https://api.openai.com/v1/embeddings'
export const DEFAULT_OPENAI_MODEL = 'text-embedding-3-small'

async function readErrorMessage(response) {
  try {
    const body = await response.json()
    return body?.error?.message ?? response.statusText
  } catch {
    return response.statusText
  }
}

/**
 * The key is sent straight from the browser, so it is only ever held in
 * memory for the session (see docs/plan.md §1.3).
 * @param {{ apiKey: string | null, model?: string }} options
 * @returns {import('./EmbeddingProvider').EmbeddingProvider}
 */
export function createOpenAIEmbeddingProvider({ apiKey, model = DEFAULT_OPENAI_MODEL }) {
  return {
    id: 'openai',
    label: `OpenAI (${model})`,
    async embed(texts) {
      if (!apiKey?.trim()) {
        throw new Error('OpenAI API key is missing. Add it in Settings or switch to another embedding mode.')
      }
      if (texts.length === 0) return []

      let response
      try {
        response = await fetch(OPENAI_EMBEDDINGS_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey.trim()}`,
          },
          body: JSON.stringify({ model, input: texts }),
        })
      } catch (error) {
        throw new Error(`Could not reach the OpenAI API: ${error.message}`, { cause: error })
      }

      if (!response.ok) {
        const reason = await readErrorMessage(response)
        const hint = response.status === 401 ? ' Check that the API key is valid.' : ''
        throw new Error(`OpenAI embeddings request failed (${response.status}): ${reason}.${hint}`)
      }

      const { data } = await response.json()
      return [...data].sort((a, b) => a.index - b.index).map((item) => item.embedding)
    },
  }
}
