import { create } from 'zustand'
import { mockAnalysisResult } from '../mocks/semanticData'
import { runAnalysisRequest } from '../services/analysisRunner'
import { useSettingsStore } from './useSettingsStore'

/** @typedef {'idle'|'running'|'success'|'error'} AnalysisStatus */
/** @typedef {import('../services/analysisPipeline').PipelineStage} PipelineStage */

// Demo mode opens with a populated dashboard instead of an empty one.
const initialResult = useSettingsStore.getState().embeddingMode === 'mock' ? mockAnalysisResult : null

export const useAnalysisStore = create((set) => ({
  analysisResult: /** @type {import('../types/models').AnalysisResult|null} */ (initialResult),
  status: /** @type {AnalysisStatus} */ ('idle'),
  stage: /** @type {PipelineStage|null} */ (null),
  error: /** @type {Error|null} */ (null),
  highlightedChunkId: /** @type {string|null} */ (null),

  /**
   * Runs with the embedding mode and key selected in Settings. On failure the
   * previous result stays on screen and the error is exposed for the form.
   * @param {import('../services/analysisRunner').AnalysisRequest} request
   */
  runAnalysis: async (request) => {
    const { embeddingMode, openaiApiKey } = useSettingsStore.getState()
    set({ status: 'running', stage: null, error: null })
    try {
      const analysisResult = await runAnalysisRequest(request, {
        mode: embeddingMode,
        openaiApiKey,
        onStage: (stage) => set({ stage }),
      })
      set({ analysisResult, status: 'success', stage: null, highlightedChunkId: null })
    } catch (error) {
      set({ status: 'error', stage: null, error })
    }
  },
  setResult: (analysisResult) => set({ analysisResult, status: 'success', stage: null, highlightedChunkId: null }),
  setHighlightedChunkId: (highlightedChunkId) => set({ highlightedChunkId }),
}))
