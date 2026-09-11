import { create } from 'zustand'
import { mockAnalysisResult } from '../mocks/semanticData'
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

  startAnalysis: () => set({ status: 'running', stage: null, error: null }),
  setStage: (stage) => set({ stage }),
  setResult: (analysisResult) => set({ analysisResult, status: 'success', stage: null, highlightedChunkId: null }),
  setError: (error) => set({ status: 'error', stage: null, error }),
  setHighlightedChunkId: (highlightedChunkId) => set({ highlightedChunkId }),
}))
