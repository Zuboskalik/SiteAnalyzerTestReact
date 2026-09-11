import { parseHeadingLine } from './headings'
import { splitParagraphs } from './vectorMath'

const normalize = (value) => value.replace(/^#+\s*/, '').trim().toLowerCase()
const headingLevel = (heading) => Number(heading.blockType.slice(1))

/**
 * Returns the part of `text` under `sectionHeading`: from that heading up to the
 * next heading of the same or a higher level, so nested subsections stay in.
 * When the text has markdown headings, short plain lines are not treated as headings.
 *
 * @param {string} text
 * @param {string} sectionHeading Matched case-insensitively; exact match first, then partial.
 * @returns {string}
 */
export function extractSection(text, sectionHeading) {
  const target = normalize(sectionHeading)
  if (!target) throw new Error('Enter the heading of the section to analyze.')

  const paragraphs = splitParagraphs(text)
  const parsed = paragraphs.map(({ start, end }) => {
    const paragraph = text.slice(start, end)
    return paragraph.includes('\n') ? null : parseHeadingLine(paragraph)
  })
  const hasMarkdown = parsed.some((heading) => heading?.isMarkdown)
  const headings = parsed.map((heading) => (heading && (!hasMarkdown || heading.isMarkdown) ? heading : null))

  let start = headings.findIndex((heading) => heading && normalize(heading.heading) === target)
  if (start === -1) start = headings.findIndex((heading) => heading && normalize(heading.heading).includes(target))
  if (start === -1) {
    throw new Error(`Section "${sectionHeading.trim()}" was not found. Enter a heading as it appears in the content.`)
  }

  const level = headingLevel(headings[start])
  const end = headings.findIndex((heading, i) => i > start && heading && headingLevel(heading) <= level)
  if (start === paragraphs.length - 1 || end === start + 1) {
    throw new Error(`Section "${headings[start].heading}" has no content under its heading.`)
  }

  const lastParagraph = end === -1 ? paragraphs.at(-1) : paragraphs[end - 1]
  return text.slice(paragraphs[start].start, lastParagraph.end)
}
