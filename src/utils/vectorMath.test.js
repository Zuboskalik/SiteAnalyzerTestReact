import { describe, expect, it } from 'vitest'
import { chunkText, cosineSimilarity, meanVector, normalizeVector, splitParagraphs, splitSentences } from './vectorMath'

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    expect(cosineSimilarity([0.1, 0.2, 0.3], [0.1, 0.2, 0.3])).toBe(1)
  })

  it('ignores magnitude', () => {
    expect(cosineSimilarity([1, 2, 3], [2, 4, 6])).toBe(1)
  })

  it('returns 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0, 0], [0, 5, 0])).toBe(0)
  })

  it('returns -1 for opposite vectors', () => {
    expect(cosineSimilarity([1, 2], [-1, -2])).toBe(-1)
  })

  it('matches a hand-computed value', () => {
    expect(cosineSimilarity([1, 2, 3], [4, 5, 6])).toBeCloseTo(32 / Math.sqrt(14 * 77), 12)
  })

  it('returns 0 when either vector has zero magnitude', () => {
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0)
    expect(cosineSimilarity([0, 0], [0, 0])).toBe(0)
  })

  it('throws on length mismatch', () => {
    expect(() => cosineSimilarity([1, 2], [1, 2, 3])).toThrow(/length mismatch/)
  })
})

describe('normalizeVector', () => {
  it('scales to unit length', () => {
    expect(normalizeVector([3, 4])).toEqual([0.6, 0.8])
  })

  it('leaves a zero vector unchanged', () => {
    expect(normalizeVector([0, 0])).toEqual([0, 0])
  })
})

describe('meanVector', () => {
  it('averages element-wise', () => {
    expect(meanVector([[1, 2], [3, 6]])).toEqual([2, 4])
  })

  it('throws on empty input', () => {
    expect(() => meanVector([])).toThrow()
  })
})

const expectExactOffsets = (text, chunks) => {
  for (const chunk of chunks) {
    expect(text.slice(chunk.charStart, chunk.charEnd)).toBe(chunk.text)
  }
}

const paragraph = (topic) =>
  `${topic} is explained in this paragraph with enough words to stand on its own as a meaningful chunk.`

describe('chunkText', () => {
  it('returns no chunks for empty or blank text', () => {
    expect(chunkText('')).toEqual([])
    expect(chunkText('  \n\n \t ')).toEqual([])
  })

  it('splits on blank lines and numbers chunks in order', () => {
    const text = [paragraph('Accounting'), paragraph('Auditing'), paragraph('Taxation')].join('\n\n')
    const chunks = chunkText(text)

    expect(chunks.map((chunk) => chunk.index)).toEqual([0, 1, 2])
    expect(chunks[1].text).toBe(paragraph('Auditing'))
    expectExactOffsets(text, chunks)
  })

  it('keeps offsets exact with CRLF line endings and indentation', () => {
    const text = `  ${paragraph('Accounting')}\r\n\r\n\t${paragraph('Auditing')}  \r\n`
    const chunks = chunkText(text)

    expect(chunks).toHaveLength(2)
    expectExactOffsets(text, chunks)
  })

  it('merges a short heading into the paragraph that follows it', () => {
    const text = `Overview\n\n${paragraph('The accountant role')}`
    const chunks = chunkText(text)

    expect(chunks).toHaveLength(1)
    expect(chunks[0].text.startsWith('Overview\n\n')).toBe(true)
    expectExactOffsets(text, chunks)
  })

  it('merges a short trailing line into the previous chunk', () => {
    const text = `${paragraph('Accounting')}\n\nThanks.`
    const chunks = chunkText(text)

    expect(chunks).toHaveLength(1)
    expect(chunks[0].text.endsWith('Thanks.')).toBe(true)
  })

  it('splits long paragraphs at sentence boundaries within maxChunkLength', () => {
    const sentences = Array.from({ length: 10 }, (_, i) => `This is sentence number ${i} of the long paragraph.`)
    const text = sentences.join(' ')
    const chunks = chunkText(text, { maxChunkLength: 120, minChunkLength: 20 })

    expect(chunks).toHaveLength(5)
    for (const chunk of chunks) {
      expect(chunk.text.length).toBeLessThanOrEqual(120)
      expect(chunk.text.endsWith('.')).toBe(true)
    }
    expectExactOffsets(text, chunks)
  })

  it('hard-splits a single sentence longer than maxChunkLength at whitespace', () => {
    const text = Array.from({ length: 60 }, (_, i) => `word${i}`).join(' ')
    const chunks = chunkText(text, { maxChunkLength: 100, minChunkLength: 10 })

    expect(chunks.length).toBeGreaterThan(1)
    for (const chunk of chunks) expect(chunk.text.length).toBeLessThanOrEqual(100)
    expect(chunks.map((chunk) => chunk.text).join(' ')).toBe(text)
    expectExactOffsets(text, chunks)
  })

  it('validates its input', () => {
    expect(() => chunkText(null)).toThrow(TypeError)
    expect(() => chunkText('text', { minChunkLength: 500, maxChunkLength: 100 })).toThrow(RangeError)
  })
})

describe('splitParagraphs', () => {
  it('returns trimmed blank-line separated spans', () => {
    const text = '  First\n\n\n Second  '
    expect(splitParagraphs(text).map(({ start, end }) => text.slice(start, end))).toEqual(['First', 'Second'])
  })
})

describe('splitSentences', () => {
  it('splits paragraphs into sentences with exact offsets, keeping headings as units', () => {
    const text = 'Overview\n\nFirst sentence here. Second one follows! Third?\n\nNew paragraph.'
    const sentences = splitSentences(text)

    expect(sentences.map((sentence) => sentence.text)).toEqual([
      'Overview',
      'First sentence here.',
      'Second one follows!',
      'Third?',
      'New paragraph.',
    ])
    for (const sentence of sentences) {
      expect(text.slice(sentence.charStart, sentence.charEnd)).toBe(sentence.text)
    }
  })

  it('hard-splits sentences longer than maxSentenceLength', () => {
    const text = Array.from({ length: 40 }, (_, i) => `word${i}`).join(' ')
    const sentences = splitSentences(text, { maxSentenceLength: 50 })

    expect(sentences.length).toBeGreaterThan(1)
    for (const sentence of sentences) expect(sentence.text.length).toBeLessThanOrEqual(50)
  })
})
