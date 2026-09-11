/**
 * Shared data contracts (docs/plan.md §3), extended with the fields the
 * reference UI needs (chunk labels/block types, summary metrics, tone notes,
 * suggestion types, Comparison Map clusters). JSDoc only — no runtime code.
 * Usage: `@typedef {import('../types/models').Chunk} Chunk`.
 */

/** @typedef {'mock'|'transformers'|'openai'} EmbeddingMode */

/** @typedef {'highly_relevant'|'broad_match'|'noise'} RelevanceZone */

/** @typedef {'paragraph'|'h1'|'h2'|'h3'|'h4'|'h5'|'h6'} BlockType */

/**
 * @typedef {Object} Chunk
 * @property {string} id
 * @property {string} text
 * @property {number} index              Position in the source document (0-based).
 * @property {number} charStart          `sourceText.slice(charStart, charEnd) === text`.
 * @property {number} charEnd
 * @property {string} label              Heading, or "Intro" / "Conclusion" / "Section N" for untitled chunks.
 * @property {string|null} heading
 * @property {BlockType} blockType
 * @property {number[]|null} embedding
 * @property {number} similarity         Cosine similarity to the target keyword, as a ratio (0–1).
 * @property {RelevanceZone} relevanceZone
 */

/**
 * @typedef {Object} PageVector
 * @property {string} id
 * @property {string|null} url           null when the page was pasted as raw text.
 * @property {string} label
 * @property {'target'|'competitor'} type
 * @property {string|null} competitorId  CompetitorSite.id when type === 'competitor'.
 * @property {string|null} clusterId     Topic cluster, for the Comparison Map's "Color: Cluster" mode.
 * @property {number[]} embedding        Mean of the page's chunk embeddings.
 * @property {number} similarityToKeyword
 * @property {string[]} chunkIds
 */

/**
 * @typedef {Object} CompetitorSite
 * @property {string} id
 * @property {string} name
 * @property {string} url
 * @property {string} color
 * @property {PageVector[]} pages
 */

/**
 * @typedef {Object} OptimizationSuggestion
 * @property {string} id
 * @property {'addition'|'structure'|'revision'} type
 * @property {'high'|'medium'|'low'} priority
 * @property {string} title
 * @property {string} description
 */

/**
 * @typedef {Object} DeepAnalysis
 * @property {string} executiveSummary
 * @property {string} toneAndReadability
 * @property {string[]} missingEntities
 * @property {OptimizationSuggestion[]} suggestions
 */

/**
 * @typedef {Object} AnalysisSummary
 * @property {number} averageRelevance           Mean chunk similarity (ratio).
 * @property {number} cohesion                   Mean similarity of chunks to their centroid (ratio; shown ×100 as "IDX").
 * @property {number} chunksNeedingOptimization  Chunks below the Highly Relevant zone.
 * @property {Record<RelevanceZone, number>} zoneCounts
 */

/**
 * @typedef {Object} AnalysisMeta
 * @property {string} targetAudience
 * @property {string} contentPurpose
 * @property {string} websiteNiche
 */

/** @typedef {'complete_article'|'specific_section'} ContentScope */

/** @typedef {'layout'|'semantic'} ChunkingStrategy */

/**
 * @typedef {Object} AnalysisOptions
 * @property {ContentScope} contentScope
 * @property {string|null} sectionHeading   Heading the analysis was limited to (specific_section only).
 * @property {ChunkingStrategy} chunkingStrategy
 */

/**
 * @typedef {Object} AnalysisResult
 * @property {string} id
 * @property {string} createdAt             ISO date.
 * @property {string} targetKeyword
 * @property {number[]} keywordEmbedding
 * @property {{ type: 'url'|'text', value: string }} inputSource  `value` is the URL, or '' for pasted text.
 * @property {AnalysisMeta} meta
 * @property {AnalysisOptions} options
 * @property {string} sourceText            Analyzed text (only the chosen section for specific_section); chunk offsets point into it.
 * @property {Chunk[]} chunks
 * @property {AnalysisSummary} summary
 * @property {PageVector} targetPage
 * @property {CompetitorSite[]} competitors
 * @property {DeepAnalysis|null} deepAnalysis
 * @property {EmbeddingMode} embeddingMode
 */

/**
 * @typedef {Object} AppSettings
 * @property {EmbeddingMode} embeddingMode
 * @property {string|null} openaiApiKey     Session memory only; never persisted.
 * @property {number} tetherThreshold       Similarity ratio (0–1); shown on a 0–10 scale as "Tether ≥".
 */

/**
 * @typedef {Object} TopicCluster
 * @property {string} id
 * @property {string} label
 * @property {string} color
 */

/**
 * Multi-site keyword comparison (the reference "Comparison" screen).
 * @typedef {Object} ComparisonMap
 * @property {{ id: string, text: string, embedding: number[] }} keyword
 * @property {(CompetitorSite & { role: 'target'|'competitor' })[]} sites
 * @property {TopicCluster[]} clusters
 * @property {{ tetherThreshold: number, gapLimit: number, showKeywords: boolean, colorBy: 'site'|'cluster' }} settings
 *   `gapLimit` mirrors the reference UI's "Gap ≤" control (0–10 scale); its exact semantics are defined with the Comparison Map in Phase 5.
 */

export {}
