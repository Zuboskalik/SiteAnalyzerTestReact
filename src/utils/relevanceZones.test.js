import { describe, expect, it } from 'vitest'
import { classifyRelevanceZone } from './relevanceZones'

describe('classifyRelevanceZone', () => {
  it.each([
    [1, 'highly_relevant'],
    [0.66, 'highly_relevant'],
    [0.651, 'highly_relevant'],
    [0.65, 'broad_match'],
    [0.645, 'broad_match'],
    [0.64, 'broad_match'],
    [0.43, 'broad_match'],
    [0.4299, 'noise'],
    [0.42, 'noise'],
    [0, 'noise'],
    [-0.3, 'noise'],
  ])('classifies %s as %s', (similarity, zone) => {
    expect(classifyRelevanceZone(similarity)).toBe(zone)
  })
})
