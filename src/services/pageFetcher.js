const SKIPPED_ELEMENTS = 'script, style, noscript, template, svg, iframe, nav, footer, aside, form, button'
const BLOCK_SELECTOR = 'h1, h2, h3, h4, h5, h6, p, li, blockquote, pre, figcaption'

const collapseWhitespace = (value) => value.replace(/\s+/g, ' ').trim()

/**
 * Readable text of an HTML page for chunking: headings become markdown
 * headings (so their levels survive) and blocks are separated by blank lines.
 * @param {string} html
 * @returns {string}
 */
export function htmlToText(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.querySelectorAll(SKIPPED_ELEMENTS).forEach((element) => element.remove())
  const root = doc.querySelector('article') ?? doc.querySelector('main') ?? doc.body
  if (!root) return ''

  const blocks = []
  for (const element of root.querySelectorAll(BLOCK_SELECTOR)) {
    // Nested blocks (e.g. <li><p>) are read once, with their outer block.
    if (element.parentElement?.closest(BLOCK_SELECTOR)) continue
    const text = collapseWhitespace(element.textContent ?? '')
    if (!text) continue
    const level = /^H([1-6])$/.exec(element.tagName)?.[1]
    if (level) blocks.push(`${'#'.repeat(Number(level))} ${text}`)
    else blocks.push(element.tagName === 'LI' ? `- ${text}` : text)
  }

  return blocks.length > 0 ? blocks.join('\n\n') : collapseWhitespace(root.textContent ?? '')
}

/**
 * Browsers only allow this for pages that send CORS headers, which most sites
 * don't — so a failed request points the user to the Text input instead.
 * @param {string} url
 * @returns {Promise<string>}
 */
export async function fetchPageText(url) {
  let response
  try {
    response = await fetch(url)
  } catch (error) {
    throw new Error(
      `Could not load ${url}. The site probably blocks cross-origin requests (CORS) — paste the page text into the Text tab instead.`,
      { cause: error },
    )
  }
  if (!response.ok) throw new Error(`Loading ${url} failed with HTTP ${response.status}.`)

  const text = htmlToText(await response.text())
  if (!text) throw new Error(`No readable text was found at ${url}.`)
  return text
}
