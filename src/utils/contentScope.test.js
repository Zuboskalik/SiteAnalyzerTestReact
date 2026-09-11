import { describe, expect, it } from 'vitest'
import { extractSection } from './contentScope'

const MARKDOWN = [
  'Accountancy is a flexible career with routes for every kind of learner.',
  '## Routes into accountancy',
  'You can study for a degree, start an apprenticeship or qualify at work.',
  '### Apprenticeships',
  'Apprentices earn a salary while their employer pays for training.',
  'Short line inside',
  '## Salary',
  'Trainees start on a modest salary that rises after exams.',
].join('\n\n')

const upToSalary = (from) => MARKDOWN.slice(MARKDOWN.indexOf(from), MARKDOWN.indexOf('\n\n## Salary'))

describe('extractSection', () => {
  it('returns a markdown section together with its nested subsections', () => {
    expect(extractSection(MARKDOWN, 'Routes into accountancy')).toBe(upToSalary('## Routes'))
  })

  it('ends a subsection at the next heading of the same or higher level', () => {
    expect(extractSection(MARKDOWN, '### apprenticeships')).toBe(upToSalary('### Apprenticeships'))
  })

  it('matches case-insensitively, then by partial heading text', () => {
    expect(extractSection(MARKDOWN, 'SALARY')).toBe(MARKDOWN.slice(MARKDOWN.indexOf('## Salary')))
    expect(extractSection(MARKDOWN, 'routes')).toContain('Apprentices earn')
  })

  it('recognises plain-text headings by layout', () => {
    const text = 'Overview\n\nThis guide covers the main routes into accountancy.\n\nSkills\n\nRecruiters value detail.'
    expect(extractSection(text, 'Overview')).toBe('Overview\n\nThis guide covers the main routes into accountancy.')
  })

  it('explains why a section cannot be used', () => {
    expect(() => extractSection(MARKDOWN, 'Pensions')).toThrow(/not found/)
    expect(() => extractSection('Intro text here.\n\n## Empty', 'Empty')).toThrow(/has no content/)
    expect(() => extractSection(MARKDOWN, '   ')).toThrow(/Enter the heading/)
  })
})
