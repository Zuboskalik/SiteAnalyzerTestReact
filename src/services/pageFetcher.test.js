// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchPageText, htmlToText } from './pageFetcher'

const PAGE = `<!doctype html>
<html>
  <head><title>Guide</title><style>p { color: red }</style></head>
  <body>
    <nav><a href="/">Home</a></nav>
    <main>
      <h1>How to become an accountant</h1>
      <p>Accountancy is a   flexible
        career.</p>
      <script>console.log('tracking')</script>
      <h2>Routes</h2>
      <ul><li><p>Degree</p></li><li>Apprenticeship</li></ul>
      <aside>Related links</aside>
    </main>
    <footer>© 2026</footer>
  </body>
</html>`

describe('htmlToText', () => {
  it('keeps headings as markdown, drops chrome and separates blocks with blank lines', () => {
    expect(htmlToText(PAGE)).toBe(
      ['# How to become an accountant', 'Accountancy is a flexible career.', '## Routes', '- Degree', '- Apprenticeship'].join(
        '\n\n',
      ),
    )
  })

  it('prefers the <article> element when there is one', () => {
    expect(htmlToText('<body><p>Sidebar teaser</p><article><h2>Story</h2><p>Body text.</p></article></body>')).toBe(
      '## Story\n\nBody text.',
    )
  })

  it('falls back to the text of the page when there are no block elements', () => {
    expect(htmlToText('<body><div>Just   some text</div></body>')).toBe('Just some text')
  })
})

describe('fetchPageText', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns the readable text of the fetched page', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: async () => PAGE }))
    await expect(fetchPageText('https://example.com/guide')).resolves.toContain('## Routes')
  })

  it('explains cross-origin failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(fetchPageText('https://example.com/guide')).rejects.toThrow(/cross-origin requests \(CORS\)/)
  })

  it('reports HTTP errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }))
    await expect(fetchPageText('https://example.com/missing')).rejects.toThrow(/HTTP 404/)
  })

  it('rejects pages without readable text', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: async () => '<body></body>' }))
    await expect(fetchPageText('https://example.com/empty')).rejects.toThrow(/No readable text/)
  })
})
