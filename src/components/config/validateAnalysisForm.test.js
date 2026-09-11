import { describe, expect, it } from 'vitest'
import { mockAnalysisFormDefaults } from '../../mocks/semanticData'
import { buildAnalysisRequest, hasErrors, validateAnalysisForm } from './validateAnalysisForm'

const values = (overrides = {}) => ({ ...mockAnalysisFormDefaults, competitorUrls: [], ...overrides })
const DEMO = { embeddingMode: 'mock', openaiApiKey: null }

describe('validateAnalysisForm', () => {
  it('accepts the demo defaults', () => {
    expect(hasErrors(validateAnalysisForm(values(), DEMO))).toBe(false)
  })

  it('requires a keyword', () => {
    expect(validateAnalysisForm(values({ keyword: '   ' }), DEMO).keyword).toMatch(/keyword/)
  })

  it('requires a full http(s) URL for the URL source', () => {
    expect(validateAnalysisForm(values({ url: '' }), DEMO).url).toMatch(/Enter the URL/)
    expect(validateAnalysisForm(values({ url: 'example.com/page' }), DEMO).url).toMatch(/http/)
    expect(validateAnalysisForm(values({ url: 'ftp://example.com' }), DEMO).url).toMatch(/http/)
  })

  it('requires enough pasted text for the Text source and ignores the URL there', () => {
    const errors = validateAnalysisForm(values({ sourceType: 'text', url: '', text: 'too short' }), DEMO)
    expect(errors.text).toMatch(/at least 50/)
    expect(errors.url).toBeUndefined()
    expect(validateAnalysisForm(values({ sourceType: 'text', text: '  ' }), DEMO).text).toMatch(/Paste the content/)
  })

  it('requires a heading for the Specific section scope', () => {
    expect(validateAnalysisForm(values({ contentScope: 'specific_section' }), DEMO).sectionHeading).toMatch(/heading/)
    expect(
      validateAnalysisForm(values({ contentScope: 'specific_section', sectionHeading: 'Salary' }), DEMO).sectionHeading,
    ).toBeUndefined()
  })

  it('flags invalid competitor URLs by row and ignores empty rows', () => {
    const errors = validateAnalysisForm(values({ competitorUrls: ['', 'not a url', 'https://ok.example.com'] }), DEMO)
    expect(errors.competitorUrls).toEqual({ 1: expect.stringMatching(/http/) })
  })

  it('requires an API key in OpenAI mode', () => {
    expect(validateAnalysisForm(values(), { embeddingMode: 'openai', openaiApiKey: ' ' }).apiKey).toMatch(/API key/)
    expect(validateAnalysisForm(values(), { embeddingMode: 'openai', openaiApiKey: 'sk-test' }).apiKey).toBeUndefined()
  })
})

describe('buildAnalysisRequest', () => {
  it('trims values, drops empty competitor rows and the inactive source', () => {
    const request = buildAnalysisRequest(
      values({
        keyword: '  law firm seo  ',
        url: ' https://a.example.com/page ',
        text: 'left over from the Text tab',
        targetAudience: ' students ',
        competitorUrls: [' https://b.example.com ', '   '],
      }),
    )

    expect(request).toEqual({
      keyword: 'law firm seo',
      sourceType: 'url',
      url: 'https://a.example.com/page',
      text: '',
      fetchedText: undefined,
      meta: {
        targetAudience: 'students',
        contentPurpose: mockAnalysisFormDefaults.contentPurpose,
        websiteNiche: mockAnalysisFormDefaults.websiteNiche,
      },
      contentScope: 'complete_article',
      sectionHeading: '',
      chunkingStrategy: 'layout',
      competitorUrls: ['https://b.example.com'],
    })
  })

  it('passes fetched text only for the URL source and the heading only for Specific section', () => {
    expect(buildAnalysisRequest(values(), 'page text').fetchedText).toBe('page text')

    const textRequest = buildAnalysisRequest(
      values({ sourceType: 'text', text: 'pasted', sectionHeading: 'Salary', contentScope: 'specific_section' }),
      'page text',
    )
    expect(textRequest).toMatchObject({ url: '', text: 'pasted', fetchedText: undefined, sectionHeading: 'Salary' })
    expect(buildAnalysisRequest(values({ sectionHeading: 'Salary' })).sectionHeading).toBe('')
  })
})
