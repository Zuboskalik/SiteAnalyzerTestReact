/**
 * Demo data mirroring the reference UI:
 *  - `mockAnalysisResult`: single-page analysis from the reference video
 *    (keyword "how to become an accountant in the uk"; Intro 49%, Overview 54%,
 *    What does an accountant do 61%, Best universities 44%, Conclusion 54%),
 *    extended to 12 chunks so all three relevance zones appear.
 *  - `mockComparisonMap`: multi-site "Comparison" screen from the reference
 *    screenshot (keyword "Law Firm SEO", 29 + 44 = 73 pages at Tether ≥ 7.5, best 8.1/10).
 *
 * Vectors are synthetic but built so that cosine similarity to the keyword
 * equals the curated score exactly, so every chart agrees with the app's own math.
 * Article copy and domains are original placeholders.
 */
import { buildPageVector, scoreChunks, summarizeChunks } from '../services/analysisPipeline'
import { chunkText, normalizeVector } from '../utils/vectorMath'

const DIMENSIONS = 64

/** mulberry32 — deterministic, so the demo looks identical on every load. */
function createRng(seed) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const randomVector = (rng) => normalizeVector(Array.from({ length: DIMENSIONS }, () => rng() * 2 - 1))

/** Unit vector at exactly `similarity` to the unit vector `anchor`, leaning toward `direction`. */
function vectorWithSimilarity(anchor, similarity, direction) {
  const projection = direction.reduce((sum, value, i) => sum + value * anchor[i], 0)
  const orthogonal = normalizeVector(direction.map((value, i) => value - projection * anchor[i]))
  const spread = Math.sqrt(1 - similarity ** 2)
  return anchor.map((value, i) => similarity * value + spread * orthogonal[i])
}

// ---------------------------------------------------------------------------
// Single-page analysis (reference video)
// ---------------------------------------------------------------------------

export const mockAnalysisFormDefaults = {
  keyword: 'how to become an accountant in the uk',
  sourceType: 'url',
  url: 'https://careers.example.co.uk/careers-advice/how-to-become/accountant',
  targetAudience: 'students looking to join career in accountancy',
  contentPurpose: 'informative and commercial',
  websiteNiche: 'third-party education website',
  contentScope: 'complete_article',
  vectorAlgorithm: 'layout_based',
}

// One entry per chunk: every paragraph is 80–600 chars, so the default
// layout-based chunkText() maps each section (heading + paragraph) to one chunk.
const ARTICLE_SECTIONS = [
  {
    heading: null,
    similarity: 0.49,
    text: 'Accountancy is one of the most flexible professional careers in Britain. Almost every organisation needs people who can keep its finances accurate, legal and useful for decision making, so qualified accountants can move between industries, sectors and even countries once they hold the right credentials.',
  },
  {
    heading: 'Overview',
    similarity: 0.54,
    text: 'This guide covers what the job involves, the main routes into the profession, the qualifications recognised by UK employers and what you can expect to earn as your career develops. Use it to compare university, apprenticeship and school-leaver pathways before you commit to one.',
  },
  {
    heading: 'What does an accountant do?',
    similarity: 0.61,
    text: "Accountants record financial transactions, prepare statements and tax returns, check that organisations follow reporting rules, and advise managers on budgets and investments. Day to day, that can mean auditing a client's books, forecasting cash flow for a start-up, or helping a charity report its spending transparently.",
  },
  {
    heading: 'Routes into accountancy in the UK',
    similarity: 0.78,
    text: 'There are three common ways to become an accountant in the UK: study for a degree and then join a graduate training scheme, start an accountancy apprenticeship straight after A-levels, or qualify part-time while working in a finance role. All three lead to the same chartered qualifications; they differ in cost, pace and how early you start earning.',
  },
  {
    heading: 'Professional qualifications: ACA, ACCA and CIMA',
    similarity: 0.72,
    text: 'To practise as a chartered accountant you will need a professional qualification. The ACA from ICAEW suits audit and advisory work, ACCA is recognised internationally and popular in industry, and CIMA focuses on management accounting inside businesses. Most trainees complete their exams over three to five years while employed.',
  },
  {
    heading: 'Accountancy apprenticeships',
    similarity: 0.68,
    text: 'Apprenticeships let you train as an accountant in the UK without paying tuition fees. Employers cover your study costs while you earn a salary, progressing from assistant accountant level to a professional apprenticeship that includes chartered exams. Entry usually requires good GCSEs in maths and English plus A-levels or equivalent.',
  },
  {
    heading: 'Best universities for accountancy courses',
    similarity: 0.44,
    text: 'League tables rank universities on teaching quality, graduate prospects and entry standards, so the best choice depends on what matters to you. Look for accredited degrees, which can exempt you from some professional exams, and check whether the course offers a placement year with a firm.',
  },
  {
    heading: 'Skills employers look for',
    similarity: 0.47,
    text: 'Beyond being comfortable with numbers, recruiters value attention to detail, clear communication, commercial awareness and the ability to explain complex figures to people without a finance background. Familiarity with spreadsheets and accounting software is expected from day one.',
  },
  {
    heading: 'Salary and career progression',
    similarity: 0.52,
    text: 'Trainees typically start on a modest salary that rises quickly once exams are passed. Newly qualified accountants can move into audit, tax, advisory, corporate finance or in-house finance teams, and experienced professionals often progress to financial controller, finance director or partner roles.',
  },
  {
    heading: 'Student life and societies',
    similarity: 0.31,
    text: 'Many campuses have lively student unions with sports clubs, drama groups, volunteering projects and hundreds of societies. Getting involved is a great way to make friends, settle into a new city and balance the demands of your timetable.',
  },
  {
    heading: 'About our careers service',
    similarity: 0.22,
    text: 'Our careers team publishes free guides on hundreds of jobs, runs virtual open days throughout the year and answers questions by email. Sign up to our newsletter to hear about new articles, events and competitions.',
  },
  {
    heading: null,
    similarity: 0.54,
    text: 'The best route depends on how you prefer to learn and how soon you want to earn. Whichever path you choose, focus on gaining an accredited qualification, building relevant work experience and staying curious about how organisations use financial information.',
  },
]

const ACCOUNTANT_COMPETITORS = [
  {
    id: 'competitor-grad-finance-hub',
    name: 'Graduate Finance Hub',
    url: 'https://gradfinancehub.example.com',
    color: '#7c6fe0',
    pages: [
      ['How to become a chartered accountant', 0.8],
      ['ACA vs ACCA vs CIMA compared', 0.71],
      ['Accounting apprenticeships guide', 0.66],
      ['Graduate schemes at the Big Four', 0.58],
    ],
  },
  {
    id: 'competitor-unicompare',
    name: 'UniCompare',
    url: 'https://unicompare.example.org',
    color: '#f59e0b',
    pages: [
      ['Accounting and finance degrees', 0.57],
      ['Top 10 universities for accounting', 0.49],
      ['Student finance explained', 0.33],
    ],
  },
]

const slugify = (label) =>
  label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

function buildAccountantAnalysis() {
  const rng = createRng(20260911)
  const keywordEmbedding = randomVector(rng)

  const sourceText = ARTICLE_SECTIONS.map(({ heading, text }) => (heading ? `${heading}\n\n${text}` : text)).join(
    '\n\n',
  )
  const rawChunks = chunkText(sourceText)
  const chunks = scoreChunks(
    rawChunks,
    rawChunks.map((_, i) => vectorWithSimilarity(keywordEmbedding, ARTICLE_SECTIONS[i].similarity, randomVector(rng))),
    keywordEmbedding,
  )

  const competitors = ACCOUNTANT_COMPETITORS.map((site) => ({
    id: site.id,
    name: site.name,
    url: site.url,
    color: site.color,
    pages: site.pages.map(([label, similarity], i) =>
      buildPageVector({
        id: `${site.id}-page-${i + 1}`,
        url: `${site.url}/${slugify(label)}`,
        label,
        type: 'competitor',
        competitorId: site.id,
        embeddings: [vectorWithSimilarity(keywordEmbedding, similarity, randomVector(rng))],
        keywordEmbedding,
      }),
    ),
  }))

  return {
    id: 'mock-analysis-accountant-uk',
    createdAt: '2026-09-11T12:00:00.000Z',
    targetKeyword: mockAnalysisFormDefaults.keyword,
    keywordEmbedding,
    inputSource: { type: 'url', value: mockAnalysisFormDefaults.url },
    meta: {
      targetAudience: mockAnalysisFormDefaults.targetAudience,
      contentPurpose: mockAnalysisFormDefaults.contentPurpose,
      websiteNiche: mockAnalysisFormDefaults.websiteNiche,
    },
    sourceText,
    chunks,
    summary: summarizeChunks(chunks),
    targetPage: buildPageVector({
      id: 'target-page',
      url: mockAnalysisFormDefaults.url,
      label: 'How to become an accountant',
      type: 'target',
      chunkIds: chunks.map((chunk) => chunk.id),
      embeddings: chunks.map((chunk) => chunk.embedding),
      keywordEmbedding,
    }),
    competitors,
    deepAnalysis: {
      executiveSummary:
        'The article outlines the main routes into accountancy but rarely ties them to concrete entry requirements: it never states the UCAS tariff points expected for degree routes, or how long each qualification path takes (the ACA, for example, usually runs three to five years). The recruitment journey stops at "apply to a firm" and skips the online psychometric tests and assessment centres most UK employers use. Coverage is also England-centric — ICAEW is named, while ICAS, essential for readers in Scotland, is missing.',
      toneAndReadability:
        'Friendly, informative tone that suits school leavers and first-year students (roughly a Grade 10–12 reading level). Long paragraphs would scan better as shorter sections, bullet lists and a comparison table.',
      missingEntities: [
        'ICAS (Institute of Chartered Accountants of Scotland)',
        'UCAS tariff points',
        'T-Levels in Finance',
        'Numerical reasoning tests',
        'Assessment centres',
        'Situational judgement tests',
        'Level 7 accountancy apprenticeship',
        'L3/L4 assistant accountant apprenticeship',
      ],
      suggestions: [
        {
          id: 'suggestion-1',
          type: 'addition',
          priority: 'high',
          title: 'Cover ICAS alongside ICAEW',
          description:
            'Add a short section on ICAS so the guide serves readers across the whole UK, not only England and Wales.',
        },
        {
          id: 'suggestion-2',
          type: 'structure',
          priority: 'medium',
          title: 'Add a qualification comparison table',
          description:
            'Map ACA, ACCA, CIMA, CIPFA and AAT to typical duration, entry requirements (UCAS points or apprenticeship level) and the career direction each one leads to.',
        },
        {
          id: 'suggestion-3',
          type: 'revision',
          priority: 'medium',
          title: 'Expand the recruitment process',
          description:
            'Describe the multi-stage application most UK firms run — online numerical and situational judgement tests, video interviews and assessment centres.',
        },
      ],
    },
    embeddingMode: 'mock',
  }
}

/** @type {import('../types/models').AnalysisResult} */
export const mockAnalysisResult = buildAccountantAnalysis()

// ---------------------------------------------------------------------------
// Multi-site Comparison Map (reference screenshot)
// ---------------------------------------------------------------------------

const LAW_FIRM_CLUSTERS = [
  {
    id: 'cluster-practice-areas',
    label: 'Practice area pages',
    color: '#f97316',
    topics: ['Personal injury lawyer SEO', 'Family law SEO', 'Criminal defense SEO', 'Estate planning SEO', 'Immigration lawyer SEO'],
  },
  {
    id: 'cluster-local-seo',
    label: 'Local SEO',
    color: '#0ea5e9',
    topics: ['Google Business Profile for law firms', 'Local citations for attorneys', 'Lawyer reviews strategy', 'Map pack rankings for lawyers', 'City landing pages for law firms'],
  },
  {
    id: 'cluster-content',
    label: 'Legal content marketing',
    color: '#a855f7',
    topics: ['Legal blog topics', 'Attorney FAQ pages', 'Case result pages', 'Legal video marketing', 'Law firm content calendar'],
  },
  {
    id: 'cluster-links',
    label: 'Link building',
    color: '#ef4444',
    topics: ['Link building for law firms', 'Legal directory backlinks', 'Digital PR for attorneys', 'Guest posting for lawyers', 'Scholarship link campaigns'],
  },
  {
    id: 'cluster-technical',
    label: 'Technical SEO',
    color: '#14b8a6',
    topics: ['Law firm site speed', 'Schema markup for attorneys', 'Law firm website migration', 'Core Web Vitals for legal sites', 'Crawl budget for large law sites'],
  },
]

const PAGE_ANGLES = ['guide', 'checklist', 'case study', 'pricing', 'for small firms', 'mistakes to avoid', 'in 2026', 'services']

const LAW_FIRM_SITES = [
  {
    id: 'site-target',
    role: 'target',
    name: 'yourfirm-seo.example.com',
    url: 'https://yourfirm-seo.example.com',
    color: '#5cbf8a',
    pagesAboveThreshold: 29,
    pagesBelowThreshold: 7,
  },
  {
    id: 'site-competitor-1',
    role: 'competitor',
    name: 'legalrank.example.com',
    url: 'https://legalrank.example.com',
    color: '#7b7be5',
    pagesAboveThreshold: 44,
    pagesBelowThreshold: 11,
  },
]

const COMPARISON_TETHER_THRESHOLD = 0.75
const COMPARISON_BEST_SIMILARITY = 0.81

function buildLawFirmComparison() {
  const rng = createRng(7_500_810)
  const keywordEmbedding = randomVector(rng)
  const clusterDirections = new Map(LAW_FIRM_CLUSTERS.map((cluster) => [cluster.id, randomVector(rng)]))

  const sites = LAW_FIRM_SITES.map((site, siteIndex) => {
    const similarities = [
      ...Array.from({ length: site.pagesAboveThreshold }, () => 0.752 + rng() * 0.05),
      ...Array.from({ length: site.pagesBelowThreshold }, () => 0.5 + rng() * 0.24),
    ]
    // The single best page ("best 8.1/10") belongs to the competitor.
    if (site.role === 'competitor') similarities[0] = COMPARISON_BEST_SIMILARITY

    const pages = similarities.map((similarity, i) => {
      const cluster = LAW_FIRM_CLUSTERS[Math.floor(rng() * LAW_FIRM_CLUSTERS.length)]
      const topic = cluster.topics[(i + siteIndex) % cluster.topics.length]
      const label = `${topic} ${PAGE_ANGLES[i % PAGE_ANGLES.length]}`
      const direction = clusterDirections.get(cluster.id).map((value) => value + (rng() * 2 - 1) * 0.5)
      return buildPageVector({
        id: `${site.id}-page-${i + 1}`,
        url: `${site.url}/${slugify(label)}-${i + 1}`,
        label,
        type: site.role,
        competitorId: site.role === 'competitor' ? site.id : null,
        clusterId: cluster.id,
        embeddings: [vectorWithSimilarity(keywordEmbedding, similarity, direction)],
        keywordEmbedding,
      })
    })

    return { id: site.id, role: site.role, name: site.name, url: site.url, color: site.color, pages }
  })

  return {
    keyword: { id: 'keyword-law-firm-seo', text: 'Law Firm SEO', embedding: keywordEmbedding },
    sites,
    clusters: LAW_FIRM_CLUSTERS.map(({ id, label, color }) => ({ id, label, color })),
    settings: { tetherThreshold: COMPARISON_TETHER_THRESHOLD, gapLimit: 5, showKeywords: true, colorBy: 'site' },
  }
}

/** @type {import('../types/models').ComparisonMap} */
export const mockComparisonMap = buildLawFirmComparison()
