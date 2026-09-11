import { describe, expect, it } from 'vitest'
import { mockAnalysisResult, mockComparisonMap } from '../mocks/semanticData'
import { radialLayout } from './vectorLayout'

const { chunks, keywordEmbedding } = mockAnalysisResult
const chunkVectors = chunks.map((chunk) => chunk.embedding)

const angularGap = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)))

describe('radialLayout', () => {
  it('places each vector at a radius proportional to 1 − cosine similarity', () => {
    const points = radialLayout(chunkVectors, keywordEmbedding, { radius: 200 })

    points.forEach((point, i) => {
      expect(point.similarity).toBeCloseTo(chunks[i].similarity, 10)
      expect(point.distance).toBeCloseTo(1 - chunks[i].similarity, 10)
      expect(Math.hypot(point.x, point.y)).toBeCloseTo(point.distance * 200, 6)
    })
  })

  it('scales by maxDistance and clamps anything farther to the edge', () => {
    const points = radialLayout(chunkVectors, keywordEmbedding, { radius: 100, maxDistance: 0.5 })

    for (const point of points) {
      expect(Math.hypot(point.x, point.y)).toBeCloseTo(Math.min(1, point.distance / 0.5) * 100, 6)
    }
  })

  it('is deterministic', () => {
    const options = { radius: 200, markerRadius: 7 }
    expect(radialLayout(chunkVectors, keywordEmbedding, options)).toEqual(radialLayout(chunkVectors, keywordEmbedding, options))
  })

  it('separates markers that would otherwise overlap', () => {
    const duplicate = chunkVectors[0]
    const points = radialLayout([duplicate, duplicate, duplicate, chunkVectors[5]], keywordEmbedding, {
      radius: 200,
      markerRadius: 6,
    })

    for (let i = 0; i < 3; i++) {
      for (let j = i + 1; j < 3; j++) {
        expect(Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y)).toBeGreaterThan(6)
      }
    }
  })

  it('keeps pages from the same topic cluster at nearby angles', () => {
    const pages = mockComparisonMap.sites.flatMap((site) => site.pages)
    const points = radialLayout(
      pages.map((page) => page.embedding),
      mockComparisonMap.keyword.embedding,
      { radius: 250, maxDistance: 0.55 },
    )
    const angles = points.map((point) => Math.atan2(point.y, point.x))

    let within = 0
    let withinPairs = 0
    let between = 0
    let betweenPairs = 0
    for (let i = 0; i < pages.length; i++) {
      for (let j = i + 1; j < pages.length; j++) {
        const gap = angularGap(angles[i], angles[j])
        if (pages[i].clusterId === pages[j].clusterId) {
          within += gap
          withinPairs++
        } else {
          between += gap
          betweenPairs++
        }
      }
    }
    expect(within / withinPairs).toBeLessThan((between / betweenPairs) * 0.7)
  })

  it('returns no points for no vectors', () => {
    expect(radialLayout([], keywordEmbedding, { radius: 100 })).toEqual([])
  })
})
