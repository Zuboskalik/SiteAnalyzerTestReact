import { describe, expect, it } from 'vitest'
import { splitSentences } from '../utils/vectorMath'
import { semanticChunks } from './semanticChunking'

const A = [1, 0]
const B = [0, 1]

const expectExactOffsets = (text, chunks) => {
  for (const chunk of chunks) expect(text.slice(chunk.charStart, chunk.charEnd)).toBe(chunk.text)
}

describe('semanticChunks', () => {
  it('starts a new chunk where the topic shifts', () => {
    const text = 'Alpha one. Alpha two. Alpha three. Beta one. Beta two. Beta three.'
    const { chunks, embeddings } = semanticChunks(text, splitSentences(text), [A, A, A, B, B, B], {
      minChunkLength: 5,
    })

    expect(chunks.map((chunk) => chunk.text)).toEqual(['Alpha one. Alpha two. Alpha three.', 'Beta one. Beta two. Beta three.'])
    expect(chunks.map((chunk) => chunk.index)).toEqual([0, 1])
    expect(embeddings).toEqual([A, B])
    expectExactOffsets(text, chunks)
  })

  it('keeps a heading with the content that follows it', () => {
    const text = 'Overview\n\nAlpha one. Alpha two.\n\nSkills\n\nBeta one. Beta two.'
    const { chunks } = semanticChunks(text, splitSentences(text), [B, A, A, B, B, B], { minChunkLength: 5 })

    expect(chunks.map((chunk) => chunk.text)).toEqual(['Overview\n\nAlpha one. Alpha two.', 'Skills\n\nBeta one. Beta two.'])
    expectExactOffsets(text, chunks)
  })

  it('splits by size when the topic never shifts', () => {
    const text = Array.from({ length: 6 }, (_, i) => `This is sentence number ${i} of the long paragraph.`).join(' ')
    const units = splitSentences(text)
    const { chunks } = semanticChunks(text, units, units.map(() => A), { maxChunkLength: 120, minChunkLength: 20 })

    expect(chunks).toHaveLength(3)
    for (const chunk of chunks) expect(chunk.text.length).toBeLessThanOrEqual(120)
    expectExactOffsets(text, chunks)
  })

  it('folds a short trailing chunk into the previous one', () => {
    const text = 'Alpha one is a sentence long enough to stand alone. Alpha two is another sentence of similar length. Beta.'
    const { chunks } = semanticChunks(text, splitSentences(text), [A, A, B], { minChunkLength: 20 })

    expect(chunks).toHaveLength(1)
    expect(chunks[0].text).toBe(text)
  })

  it('returns nothing for no units', () => {
    expect(semanticChunks('', [], [])).toEqual({ chunks: [], embeddings: [] })
  })
})
