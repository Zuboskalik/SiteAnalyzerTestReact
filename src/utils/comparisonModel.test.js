import { describe, expect, it } from 'vitest'
import { mockAnalysisResult, mockComparisonMap } from '../mocks/semanticData'
import { comparisonMapFromAnalysis, TARGET_SITE_COLOR, tetherStats } from './comparisonModel'

describe('comparisonMapFromAnalysis', () => {
  it('puts the analyzed page on the target site, followed by the competitor sites', () => {
    const map = comparisonMapFromAnalysis(mockAnalysisResult)

    expect(map.keyword).toEqual({
      id: 'keyword',
      text: mockAnalysisResult.targetKeyword,
      embedding: mockAnalysisResult.keywordEmbedding,
    })
    expect(map.sites[0]).toMatchObject({
      role: 'target',
      name: 'careers.example.co.uk',
      color: TARGET_SITE_COLOR,
      pages: [mockAnalysisResult.targetPage],
    })
    expect(map.sites.slice(1).map((site) => [site.role, site.name])).toEqual([
      ['competitor', 'Graduate Finance Hub'],
      ['competitor', 'UniCompare'],
    ])
    expect(map.clusters).toEqual([])
  })

  it('names the target site after pasted text when there is no URL', () => {
    const map = comparisonMapFromAnalysis({
      ...mockAnalysisResult,
      targetPage: { ...mockAnalysisResult.targetPage, url: null },
    })
    expect(map.sites[0]).toMatchObject({ name: 'Your content', url: '' })
  })
})

describe('tetherStats', () => {
  it('reproduces the reference screenshot counts at Tether ≥ 7.5', () => {
    const stats = tetherStats(mockComparisonMap, 0.75)

    expect(stats.total).toBe(73)
    expect(stats.perSite).toEqual({ 'site-target': 29, 'site-competitor-1': 44 })
    expect(stats.bestSimilarity).toBeCloseTo(0.81, 10)
  })

  it('counts every page at threshold 0 and none above the best page', () => {
    const pages = mockComparisonMap.sites.reduce((count, site) => count + site.pages.length, 0)
    expect(tetherStats(mockComparisonMap, 0).total).toBe(pages)
    expect(tetherStats(mockComparisonMap, 0.82).total).toBe(0)
  })
})
