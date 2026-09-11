/**
 * @typedef {Object} AnalysisFormValues
 * @property {string} keyword
 * @property {'url'|'text'} sourceType
 * @property {string} url
 * @property {string} text
 * @property {string} targetAudience
 * @property {string} contentPurpose
 * @property {string} websiteNiche
 * @property {import('../../types/models').ContentScope} contentScope
 * @property {string} sectionHeading
 * @property {import('../../types/models').ChunkingStrategy} chunkingStrategy
 * @property {string[]} competitorUrls   Rows as typed, including empty ones.
 */

/**
 * @typedef {Object} AnalysisFormErrors
 * @property {string} [keyword]
 * @property {string} [url]
 * @property {string} [text]
 * @property {string} [sectionHeading]
 * @property {Record<number, string>} [competitorUrls] Keyed by row index.
 * @property {string} [apiKey]
 */

export const MIN_TEXT_LENGTH = 50
const URL_FORMAT_ERROR = 'Enter a full URL starting with http:// or https://.'

/** @param {string} value */
export function isHttpUrl(value) {
  try {
    const { protocol } = new URL(value)
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * @param {AnalysisFormValues} values
 * @param {{ embeddingMode: import('../../types/models').EmbeddingMode, openaiApiKey: string|null }} settings
 * @returns {AnalysisFormErrors}
 */
export function validateAnalysisForm(values, { embeddingMode, openaiApiKey }) {
  const errors = {}

  if (!values.keyword.trim()) errors.keyword = 'Enter the target keyword or prompt.'

  if (values.sourceType === 'url') {
    const url = values.url.trim()
    if (!url) errors.url = 'Enter the URL of the page to analyze.'
    else if (!isHttpUrl(url)) errors.url = URL_FORMAT_ERROR
  } else {
    const length = values.text.trim().length
    if (length === 0) errors.text = 'Paste the content to analyze.'
    else if (length < MIN_TEXT_LENGTH) errors.text = `Paste at least ${MIN_TEXT_LENGTH} characters of content.`
  }

  if (values.contentScope === 'specific_section' && !values.sectionHeading.trim()) {
    errors.sectionHeading = 'Enter the heading of the section to analyze.'
  }

  const competitorErrors = {}
  values.competitorUrls.forEach((url, index) => {
    if (url.trim() && !isHttpUrl(url.trim())) competitorErrors[index] = URL_FORMAT_ERROR
  })
  if (Object.keys(competitorErrors).length > 0) errors.competitorUrls = competitorErrors

  if (embeddingMode === 'openai' && !openaiApiKey?.trim()) {
    errors.apiKey = 'Add your OpenAI API key in Embedding mode settings, or switch to Demo or Local AI.'
  }

  return errors
}

/** @param {AnalysisFormErrors} errors */
export const hasErrors = (errors) => Object.keys(errors).length > 0

/**
 * @param {AnalysisFormValues} values Already validated.
 * @param {string} [fetchedText] Text loaded with the Fetch button for the current URL.
 * @returns {import('../../services/analysisRunner').AnalysisRequest}
 */
export function buildAnalysisRequest(values, fetchedText) {
  const isUrl = values.sourceType === 'url'
  return {
    keyword: values.keyword.trim(),
    sourceType: values.sourceType,
    url: isUrl ? values.url.trim() : '',
    text: isUrl ? '' : values.text,
    fetchedText: isUrl ? fetchedText : undefined,
    meta: {
      targetAudience: values.targetAudience.trim(),
      contentPurpose: values.contentPurpose.trim(),
      websiteNiche: values.websiteNiche.trim(),
    },
    contentScope: values.contentScope,
    sectionHeading: values.contentScope === 'specific_section' ? values.sectionHeading.trim() : '',
    chunkingStrategy: values.chunkingStrategy,
    competitorUrls: values.competitorUrls.map((url) => url.trim()).filter(Boolean),
  }
}
