import { describe, expect, it, vi } from 'vitest'
import { classifyRelevanceZone } from '../utils/relevanceZones'
import { cosineSimilarity, splitSentences } from '../utils/vectorMath'
import { analyzeContent, detectHeading, summarizeChunks } from './analysisPipeline'
import { createMockEmbeddingProvider } from './embeddings/mockEmbeddingProvider'

const SOURCE_TEXT = [
  'Accountancy is a flexible career: qualified accountants work in almost every industry and can move between sectors once chartered.',
  '## Routes into accountancy\n\nYou can become an accountant in the UK through a degree, an apprenticeship or by qualifying while working in a finance team.',
  'Our office also sponsors a local youth football league and hosts a charity bake sale every spring for the community.',
].join('\n\n')

const baseInput = () => ({
  keyword: '  how to become an accountant in the uk ',
  sourceText: SOURCE_TEXT,
  inputSource: { type: 'url', value: 'https://example.com/accountant' },
  meta: { targetAudience: 'students', contentPurpose: 'informative', websiteNiche: 'education' },
  provider: createMockEmbeddingProvider(),
})

describe('analyzeContent', () => {
  it('chunks, embeds and scores the source text into an AnalysisResult', async () => {
    const result = await analyzeContent(baseInput())

    expect(result.targetKeyword).toBe('how to become an accountant in the uk')
    expect(result.embeddingMode).toBe('mock')
    expect(result.deepAnalysis).toBeNull()
    expect(result.chunks.map((chunk) => chunk.label)).toEqual(['Intro', 'Routes into accountancy', 'Conclusion'])
    expect(result.chunks.map((chunk) => chunk.blockType)).toEqual(['paragraph', 'h2', 'paragraph'])

    for (const chunk of result.chunks) {
      expect(result.sourceText.slice(chunk.charStart, chunk.charEnd)).toBe(chunk.text)
      expect(chunk.similarity).toBe(cosineSimilarity(chunk.embedding, result.keywordEmbedding))
      expect(chunk.relevanceZone).toBe(classifyRelevanceZone(chunk.similarity))
    }

    expect(result.targetPage).toMatchObject({
      type: 'target',
      url: 'https://example.com/accountant',
      chunkIds: ['chunk-1', 'chunk-2', 'chunk-3'],
    })
    const { zoneCounts } = result.summary
    expect(zoneCounts.highly_relevant + zoneCounts.broad_match + zoneCounts.noise).toBe(3)
  })

  it('scores on-topic chunks above off-topic ones', async () => {
    const { chunks } = await analyzeContent(baseInput())
    expect(chunks[1].similarity).toBeGreaterThan(chunks[2].similarity)
  })

  it('sends every text to the provider in one call and reports stages in order', async () => {
    const provider = createMockEmbeddingProvider()
    const embed = vi.spyOn(provider, 'embed')
    const stages = []

    await analyzeContent({ ...baseInput(), provider, onStage: (stage) => stages.push(stage) })

    expect(embed).toHaveBeenCalledTimes(1)
    expect(embed.mock.calls[0][0]).toHaveLength(1 + 3)
    expect(stages).toEqual(['chunking', 'embedding', 'scoring', 'aggregating'])
  })

  it('builds page vectors for competitor pages and skips empty ones', async () => {
    const result = await analyzeContent({
      ...baseInput(),
      competitors: [
        {
          id: 'rival',
          name: 'Rival',
          url: 'https://rival.example.com',
          color: '#7c6fe0',
          pages: [
            {
              id: 'rival-1',
              url: 'https://rival.example.com/become-an-accountant',
              label: 'Become an accountant',
              text: 'Becoming an accountant in the UK starts with choosing between a degree and an apprenticeship route.',
            },
            { id: 'rival-2', url: 'https://rival.example.com/empty', label: 'Empty', text: '   ' },
          ],
        },
      ],
    })

    expect(result.competitors).toHaveLength(1)
    expect(result.competitors[0].pages).toHaveLength(1)
    const [page] = result.competitors[0].pages
    expect(page).toMatchObject({ id: 'rival-1', type: 'competitor', competitorId: 'rival' })
    expect(page.similarityToKeyword).toBe(cosineSimilarity(page.embedding, result.keywordEmbedding))
  })

  it('rejects a blank keyword or blank source text', async () => {
    await expect(analyzeContent({ ...baseInput(), keyword: '   ' })).rejects.toThrow(/keyword is required/)
    await expect(analyzeContent({ ...baseInput(), sourceText: '\n\n' })).rejects.toThrow(/source content is empty/)
  })

  it('rejects a provider that returns the wrong number of vectors', async () => {
    const provider = { id: 'mock', label: 'broken', embed: async () => [[1, 0]] }
    await expect(analyzeContent({ ...baseInput(), provider })).rejects.toThrow(/returned 1 vectors for 4 texts/)
  })
})

describe('detectHeading', () => {
  it('reads markdown heading levels', () => {
    expect(detectHeading('### Salary\n\nTrainees start on...')).toEqual({ heading: 'Salary', blockType: 'h3' })
  })

  it('treats a short first line followed by a blank line as a section heading', () => {
    expect(detectHeading('What does an accountant do?\n\nAccountants record...')).toEqual({
      heading: 'What does an accountant do?',
      blockType: 'h2',
    })
  })

  it('does not treat sentences or single-block paragraphs as headings', () => {
    expect(detectHeading('Good luck.\n\nMore text follows here.')).toEqual({ heading: null, blockType: 'paragraph' })
    expect(detectHeading('A plain paragraph without any line breaks.')).toEqual({ heading: null, blockType: 'paragraph' })
  })
})

describe('summarizeChunks', () => {
  it('computes average relevance, cohesion and chunks needing optimization', () => {
    const chunks = [
      { similarity: 0.8, relevanceZone: 'highly_relevant', embedding: [1, 0] },
      { similarity: 0.5, relevanceZone: 'broad_match', embedding: [1, 0] },
      { similarity: 0.2, relevanceZone: 'noise', embedding: [1, 0] },
    ]

    const summary = summarizeChunks(chunks)
    expect(summary.averageRelevance).toBeCloseTo(0.5, 12)
    expect(summary.cohesion).toBe(1)
    expect(summary.chunksNeedingOptimization).toBe(2)
    expect(summary.zoneCounts).toEqual({ highly_relevant: 1, broad_match: 1, noise: 1 })
  })
})

describe('analyzeContent options', () => {
  it('records layout chunking and the complete-article scope by default', async () => {
    const { options } = await analyzeContent(baseInput())
    expect(options).toEqual({ contentScope: 'complete_article', sectionHeading: null, chunkingStrategy: 'layout' })
  })

  it('groups sentence embeddings into chunks with semantic chunking, in one embed call', async () => {
    const provider = createMockEmbeddingProvider()
    const embed = vi.spyOn(provider, 'embed')

    const result = await analyzeContent({
      ...baseInput(),
      provider,
      chunking: { strategy: 'semantic', minChunkLength: 20 },
      scope: { contentScope: 'specific_section', sectionHeading: 'Routes' },
    })

    expect(result.options).toEqual({ contentScope: 'specific_section', sectionHeading: 'Routes', chunkingStrategy: 'semantic' })
    expect(embed).toHaveBeenCalledTimes(1)
    expect(embed.mock.calls[0][0]).toHaveLength(1 + splitSentences(SOURCE_TEXT).length)
    expect(result.chunks.length).toBeGreaterThan(0)
    for (const chunk of result.chunks) {
      expect(result.sourceText.slice(chunk.charStart, chunk.charEnd)).toBe(chunk.text)
      expect(chunk.similarity).toBe(cosineSimilarity(chunk.embedding, result.keywordEmbedding))
    }
  })
})
