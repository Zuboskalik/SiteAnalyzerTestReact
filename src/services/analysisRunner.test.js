import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockAnalysisFormDefaults, mockAnalysisResult } from '../mocks/semanticData'
import { loadSourceText, runAnalysisRequest } from './analysisRunner'
import { fetchPageText } from './pageFetcher'

vi.mock('./pageFetcher', () => ({ fetchPageText: vi.fn() }))

const ARTICLE = [
  '## Routes into accountancy',
  'You can become an accountant in the UK through a degree or an apprenticeship.',
  '## Salary',
  'Trainees start on a modest salary that rises quickly once exams are passed.',
].join('\n\n')

const ALL_STAGES = ['fetching', 'chunking', 'embedding', 'scoring', 'aggregating']

const request = (overrides = {}) => ({
  keyword: mockAnalysisFormDefaults.keyword,
  sourceType: 'url',
  url: mockAnalysisFormDefaults.url,
  text: '',
  meta: { targetAudience: 'students', contentPurpose: 'informational', websiteNiche: 'education' },
  contentScope: 'complete_article',
  sectionHeading: '',
  chunkingStrategy: 'layout',
  competitorUrls: [],
  ...overrides,
})

async function run(analysisRequest, options = {}) {
  const stages = []
  const result = await runAnalysisRequest(analysisRequest, {
    mode: 'mock',
    stageDelayMs: 0,
    onStage: (stage) => stages.push(stage),
    ...options,
  })
  return { result, stages }
}

beforeEach(() => {
  vi.mocked(fetchPageText).mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('runAnalysisRequest in demo mode', () => {
  it('returns the curated reference result for the reference scenario', async () => {
    const { result, stages } = await run(request())

    expect(result.chunks).toBe(mockAnalysisResult.chunks)
    expect(result.id).not.toBe(mockAnalysisResult.id)
    expect(result.meta).toEqual(request().meta)
    expect(result.options).toEqual({ contentScope: 'complete_article', sectionHeading: null, chunkingStrategy: 'layout' })
    expect(stages).toEqual(ALL_STAGES)
  })

  it('scores the sample article with mock vectors for other keywords, without network access', async () => {
    const { result, stages } = await run(request({ keyword: 'accountancy apprenticeships' }))

    expect(result.sourceText).toBe(mockAnalysisResult.sourceText)
    expect(result.chunks).not.toBe(mockAnalysisResult.chunks)
    expect(result.targetKeyword).toBe('accountancy apprenticeships')
    expect(result.embeddingMode).toBe('mock')
    expect(fetchPageText).not.toHaveBeenCalled()
    expect(stages).toEqual(ALL_STAGES)
  })

  it('analyzes pasted text', async () => {
    const { result } = await run(request({ sourceType: 'text', url: '', text: ARTICLE }))

    expect(result.inputSource).toEqual({ type: 'text', value: '' })
    expect(result.sourceText).toBe(ARTICLE)
    expect(result.chunks.map((chunk) => chunk.label)).toEqual(['Routes into accountancy', 'Salary'])
  })

  it('analyzes only the requested section', async () => {
    const { result } = await run(
      request({ sourceType: 'text', url: '', text: ARTICLE, contentScope: 'specific_section', sectionHeading: 'Salary' }),
    )

    expect(result.sourceText).toBe(ARTICLE.slice(ARTICLE.indexOf('## Salary')))
    expect(result.options).toEqual({ contentScope: 'specific_section', sectionHeading: 'Salary', chunkingStrategy: 'layout' })
  })

  it('uses semantic chunking when requested, even for the reference URL', async () => {
    const { result } = await run(request({ chunkingStrategy: 'semantic' }))

    expect(result.chunks).not.toBe(mockAnalysisResult.chunks)
    expect(result.options.chunkingStrategy).toBe('semantic')
    for (const chunk of result.chunks) {
      expect(result.sourceText.slice(chunk.charStart, chunk.charEnd)).toBe(chunk.text)
    }
  })

  it('simulates competitor pages and groups them by site', async () => {
    const { result } = await run(
      request({
        keyword: 'become a chartered accountant',
        competitorUrls: [
          'https://rival.example.com/become-an-accountant',
          'https://rival.example.com/aca-vs-acca',
          'https://other.example.org/guide',
        ],
      }),
    )

    expect(result.competitors.map((site) => site.name)).toEqual(['rival.example.com', 'other.example.org'])
    expect(result.competitors[0].pages.map((page) => page.label)).toEqual(['become an accountant', 'aca vs acca'])
    expect(result.competitors[0].color).not.toBe(result.competitors[1].color)
    expect(fetchPageText).not.toHaveBeenCalled()
  })
})

describe('runAnalysisRequest with real embeddings', () => {
  const stubOpenAI = () =>
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url, init) => {
        const { input } = JSON.parse(init.body)
        return {
          ok: true,
          json: async () => ({
            data: input.map((text, index) => ({ index, embedding: [(text.length % 7) + 1, 1, index % 3] })),
          }),
        }
      }),
    )

  it('fetches the page and competitor URLs', async () => {
    stubOpenAI()
    vi.mocked(fetchPageText).mockImplementation(async (url) =>
      url.includes('rival') ? 'Rival page about becoming an accountant, with enough text to form one chunk.' : ARTICLE,
    )

    const { result, stages } = await run(
      request({ url: 'https://site.example.com/guide', competitorUrls: ['https://rival.example.com/a'] }),
      { mode: 'openai', openaiApiKey: 'sk-test' },
    )

    expect(fetchPageText).toHaveBeenCalledWith('https://site.example.com/guide')
    expect(fetchPageText).toHaveBeenCalledWith('https://rival.example.com/a')
    expect(result.embeddingMode).toBe('openai')
    expect(result.sourceText).toBe(ARTICLE)
    expect(result.competitors[0].pages).toHaveLength(1)
    expect(stages).toEqual(ALL_STAGES)
  })

  it('reuses text already loaded with the Fetch button', async () => {
    stubOpenAI()
    const { result } = await run(request({ url: 'https://site.example.com/guide', fetchedText: ARTICLE }), {
      mode: 'openai',
      openaiApiKey: 'sk-test',
    })

    expect(fetchPageText).not.toHaveBeenCalled()
    expect(result.sourceText).toBe(ARTICLE)
  })

  it('fails with a readable error when the OpenAI key is missing', async () => {
    vi.mocked(fetchPageText).mockResolvedValue(ARTICLE)
    await expect(
      run(request({ url: 'https://site.example.com/guide' }), { mode: 'openai', openaiApiKey: null }),
    ).rejects.toThrow(/API key is missing/)
  })
})

describe('loadSourceText', () => {
  it('uses the sample article for any URL in demo mode', async () => {
    expect(await loadSourceText({ sourceType: 'url', url: 'https://anything.example.com' }, 'mock')).toBe(
      mockAnalysisResult.sourceText,
    )
  })

  it('returns pasted text unchanged', async () => {
    expect(await loadSourceText({ sourceType: 'text', text: ARTICLE }, 'openai')).toBe(ARTICLE)
  })
})
