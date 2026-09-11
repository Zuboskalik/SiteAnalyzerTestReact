import { create } from 'zustand'

/** @typedef {import('../types/models').AppSettings} AppSettings */

export const useSettingsStore = create((set) => ({
  embeddingMode: /** @type {AppSettings['embeddingMode']} */ ('mock'),
  // Held in memory only — never written to storage or the URL.
  openaiApiKey: /** @type {string|null} */ (null),
  tetherThreshold: 0.75,

  setEmbeddingMode: (embeddingMode) => set({ embeddingMode }),
  setOpenaiApiKey: (openaiApiKey) => set({ openaiApiKey }),
  setTetherThreshold: (tetherThreshold) => set({ tetherThreshold }),
}))
