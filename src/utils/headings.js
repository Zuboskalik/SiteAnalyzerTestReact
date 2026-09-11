const MARKDOWN_HEADING = /^(#{1,6})\s+(.+)$/
const MAX_HEADING_LENGTH = 80

/**
 * Markdown headings keep their level. A plain short line that doesn't end in a
 * full stop is read as a section heading (h2), the common case in pasted text.
 * @param {string} line A single line of text.
 * @returns {{ heading: string, blockType: 'h1'|'h2'|'h3'|'h4'|'h5'|'h6', isMarkdown: boolean } | null}
 */
export function parseHeadingLine(line) {
  const trimmed = line.trim()
  const markdown = trimmed.match(MARKDOWN_HEADING)
  if (markdown) return { heading: markdown[2].trim(), blockType: `h${markdown[1].length}`, isMarkdown: true }
  if (trimmed && trimmed.length <= MAX_HEADING_LENGTH && !trimmed.endsWith('.')) {
    return { heading: trimmed, blockType: 'h2', isMarkdown: false }
  }
  return null
}
