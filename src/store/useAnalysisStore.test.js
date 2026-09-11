import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockAnalysisResult } from '../mocks/semanticData'
import { runAnalysisRequest } from '../services/analysisRunner'
import { useAnalysisStore } from './useAnalysisStore'
import { useSettingsStore } from './useSettingsStore'

vi.mock('../services/analysisRunner', () => ({ runAnalysisRequest: vi.fn() }))

const initialState = useAnalysisStore.getState()

beforeEach(() => {
  useAnalysisStore.setState(initialState, true)
  useSettingsStore.setState({ embeddingMode: 'mock', openaiApiKey: null })
  vi.mocked(runAnalysisRequest).mockReset()
})

describe('useAnalysisStore', () => {
  it('starts with the demo result in demo mode', () => {
    expect(initialState.analysisResult).toBe(mockAnalysisResult)
    expect(initialState.status).toBe('idle')
  })

  it('runs an analysis with the selected settings, tracking status and stage', async () => {
    useSettingsStore.setState({ embeddingMode: 'openai', openaiApiKey: 'sk-test' })
    useAnalysisStore.setState({ highlightedChunkId: 'chunk-3' })
    const computed = { ...mockAnalysisResult, id: 'computed' }
    let whileRunning
    vi.mocked(runAnalysisRequest).mockImplementation(async (_request, { onStage }) => {
      onStage('embedding')
      const { status, stage } = useAnalysisStore.getState()
      whileRunning = { status, stage }
      return computed
    })

    await useAnalysisStore.getState().runAnalysis({ keyword: 'k' })

    expect(runAnalysisRequest).toHaveBeenCalledWith(
      { keyword: 'k' },
      expect.objectContaining({ mode: 'openai', openaiApiKey: 'sk-test' }),
    )
    expect(whileRunning).toEqual({ status: 'running', stage: 'embedding' })
    expect(useAnalysisStore.getState()).toMatchObject({
      analysisResult: computed,
      status: 'success',
      stage: null,
      error: null,
      highlightedChunkId: null,
    })
  })

  it('keeps the previous result and exposes the error when an analysis fails', async () => {
    const failure = new Error('boom')
    vi.mocked(runAnalysisRequest).mockRejectedValue(failure)

    await useAnalysisStore.getState().runAnalysis({ keyword: 'k' })

    const state = useAnalysisStore.getState()
    expect(state.analysisResult).toBe(mockAnalysisResult)
    expect(state.status).toBe('error')
    expect(state.stage).toBeNull()
    expect(state.error).toBe(failure)
  })
})
