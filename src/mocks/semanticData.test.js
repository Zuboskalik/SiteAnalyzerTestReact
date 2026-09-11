import { describe, expect, it } from 'vitest'
import { classifyRelevanceZone } from '../utils/relevanceZones'
import { cosineSimilarity } from '../utils/vectorMath'
import { mockAnalysisResult, mockComparisonMap } from './semanticData'

const toPercent = (similarity) => Math.round(similarity * 100)

describe('mockAnalysisResult', () => {
  const { chunks, sourceText, keywordEmbedding } = mockAnalysisResult

  it('has at least 10 chunks covering all three relevance zones', () => {
    expect(chunks.length).toBeGreaterThanOrEqual(10)
    expect(new Set(chunks.map((chunk) => chunk.relevanceZone))).toEqual(
      new Set(['highly_relevant', 'broad_match', 'noise']),
    )
  })

  it('reproduces the chunk scores shown in the reference video', () => {
    const scoreByLabel = Object.fromEntries(chunks.map((chunk) => [chunk.label, toPercent(chunk.similarity)]))
    expect(scoreByLabel).toMatchObject({
      Intro: 49,
      Overview: 54,
      'What does an accountant do?': 61,
      'Best universities for accountancy courses': 44,
      Conclusion: 54,
    })
    expect(chunks.find((chunk) => chunk.label === 'Overview').blockType).toBe('h2')
    expect(chunks[0].blockType).toBe('paragraph')
  })

  it('is internally consistent with the math module', () => {
    for (const chunk of chunks) {
      expect(sourceText.slice(chunk.charStart, chunk.charEnd)).toBe(chunk.text)
      expect(cosineSimilarity(chunk.embedding, keywordEmbedding)).toBeCloseTo(chunk.similarity, 12)
      expect(chunk.relevanceZone).toBe(classifyRelevanceZone(chunk.similarity))
    }
    expect(mockAnalysisResult.summary.chunksNeedingOptimization).toBe(
      chunks.filter((chunk) => chunk.relevanceZone !== 'highly_relevant').length,
    )
  })

  it('includes competitors and a filled deep analysis', () => {
    expect(mockAnalysisResult.competitors.length).toBeGreaterThanOrEqual(1)
    expect(mockAnalysisResult.competitors[0].pages.length).toBeGreaterThanOrEqual(2)

    const { deepAnalysis } = mockAnalysisResult
    expect(deepAnalysis.executiveSummary).toBeTruthy()
    expect(deepAnalysis.missingEntities.length).toBeGreaterThan(0)
    expect(deepAnalysis.suggestions.map((suggestion) => suggestion.type)).toEqual([
      'addition',
      'structure',
      'revision',
    ])
  })
})

describe('mockComparisonMap', () => {
  const { keyword, sites, settings } = mockComparisonMap
  const aboveThreshold = (site) => site.pages.filter((page) => page.similarityToKeyword >= settings.tetherThreshold)

  it('reproduces the reference screenshot summary (29 + 44 = 73 pages ≥ 7.5, best 8.1/10)', () => {
    expect(keyword.text).toBe('Law Firm SEO')
    expect(settings.tetherThreshold * 10).toBe(7.5)
    expect(sites.map((site) => aboveThreshold(site).length)).toEqual([29, 44])

    const best = Math.max(...sites.flatMap((site) => site.pages.map((page) => page.similarityToKeyword)))
    expect(Math.round(best * 100) / 10).toBe(8.1)
  })

  it('keeps some pages below the tether threshold for filtering', () => {
    for (const site of sites) {
      expect(site.pages.length).toBeGreaterThan(aboveThreshold(site).length)
    }
  })

  it('assigns every page a known cluster and a consistent similarity', () => {
    const clusterIds = new Set(mockComparisonMap.clusters.map((cluster) => cluster.id))
    for (const page of sites.flatMap((site) => site.pages)) {
      expect(clusterIds.has(page.clusterId)).toBe(true)
      expect(cosineSimilarity(page.embedding, keyword.embedding)).toBeCloseTo(page.similarityToKeyword, 12)
    }
  })
})
