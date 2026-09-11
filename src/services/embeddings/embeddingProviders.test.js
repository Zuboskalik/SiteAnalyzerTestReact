import { afterEach, describe, expect, it, vi } from 'vitest'
import { cosineSimilarity } from '../../utils/vectorMath'
import { createEmbeddingProvider } from './EmbeddingProvider'
import { createMockEmbeddingProvider } from './mockEmbeddingProvider'
import { createOpenAIEmbeddingProvider } from './openaiEmbeddingProvider'

describe('mock embedding provider', () => {
  const provider = createMockEmbeddingProvider()

  it('is deterministic for the same text', async () => {
    const [first] = await provider.embed(['how to become an accountant in the uk'])
    const [second] = await provider.embed(['how to become an accountant in the uk'])
    expect(first).toEqual(second)
  })

  it('returns one unit vector per text', async () => {
    const vectors = await provider.embed(['alpha', 'beta gamma'])
    expect(vectors).toHaveLength(2)
    for (const vector of vectors) {
      expect(vector).toHaveLength(256)
      expect(Math.hypot(...vector)).toBeCloseTo(1, 10)
    }
  })

  it('rates overlapping text above unrelated text', async () => {
    const [keyword, related, unrelated] = await provider.embed([
      'how to become an accountant in the uk',
      'To become a chartered accountant in the UK you need an accountancy qualification.',
      'Our office sponsors a local youth football league every summer.',
    ])
    expect(cosineSimilarity(keyword, related)).toBeGreaterThan(cosineSimilarity(keyword, unrelated))
  })

  it('returns an empty list for no input', async () => {
    expect(await provider.embed([])).toEqual([])
  })
})

describe('OpenAI embedding provider', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('rejects with a readable error when the key is missing', async () => {
    const provider = createOpenAIEmbeddingProvider({ apiKey: '' })
    await expect(provider.embed(['text'])).rejects.toThrow(/API key is missing/)
  })

  it('returns embeddings in input order', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { index: 1, embedding: [0, 1] },
          { index: 0, embedding: [1, 0] },
        ],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const provider = createOpenAIEmbeddingProvider({ apiKey: 'sk-test' })
    expect(await provider.embed(['a', 'b'])).toEqual([
      [1, 0],
      [0, 1],
    ])

    const [url, request] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.openai.com/v1/embeddings')
    expect(request.headers.Authorization).toBe('Bearer sk-test')
    expect(JSON.parse(request.body)).toEqual({ model: 'text-embedding-3-small', input: ['a', 'b'] })
  })

  it('surfaces API errors such as an invalid key', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ error: { message: 'Incorrect API key provided' } }),
      }),
    )

    const provider = createOpenAIEmbeddingProvider({ apiKey: 'sk-bad' })
    await expect(provider.embed(['text'])).rejects.toThrow(/401.*Incorrect API key provided.*Check that the API key is valid/)
  })

  it('wraps network failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    const provider = createOpenAIEmbeddingProvider({ apiKey: 'sk-test' })
    await expect(provider.embed(['text'])).rejects.toThrow(/Could not reach the OpenAI API: Failed to fetch/)
  })
})

describe('createEmbeddingProvider', () => {
  it('selects the implementation by mode', () => {
    expect(createEmbeddingProvider({ mode: 'mock' }).id).toBe('mock')
    expect(createEmbeddingProvider({ mode: 'transformers' }).id).toBe('transformers')
    expect(createEmbeddingProvider({ mode: 'openai', openaiApiKey: 'sk-test' }).id).toBe('openai')
  })

  it('rejects unknown modes', () => {
    expect(() => createEmbeddingProvider({ mode: 'nope' })).toThrow(/Unknown embedding mode/)
  })
})
