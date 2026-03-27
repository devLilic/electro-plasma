import type { ImportedPlaylist, ImportedPlaylistItem, PlaylistImportInput } from '../../domain/playlist-import'
import { inferPlaylistTitle, isHtmImport, stripHtml } from './enps-import-helpers'

const SECTION_SPLIT = /<a\b[^>]*(?:name|id)\s*=\s*(?:"([^"]+)"|'([^']+)'|([^>]*?))\s*>/gi

const IRRELEVANT_LINE_PATTERNS = [
  /^page\s+\d+/i,
  /^newsroom\b/i,
  /^marker\b/i,
  /^rundown\b/i,
  /^wire\b/i,
  /^nrcs\b/i,
  /^enps\b/i,
  /^return to index of stories/i,
  /^click here for a full graphical version/i,
  /^-{2,}$/,
  /^\[.*\]$/,
  /^<{2,}.*>{2,}$/,
]

const IRRELEVANT_ANCHOR_PATTERNS = [
  /^storyindex$/i,
]

export function parseEnpsTextHtm(input: PlaylistImportInput): ImportedPlaylist {
  if (!isHtmImport(input)) {
    throw new Error(`Unsupported ENPS HTM import: ${input.fileName}`)
  }

  const html = input.textContent ?? ''
  const sections = splitIntoSections(html)
  const items = sections
    .map((section, index) => parseSection(section.anchor, section.html, index))
    .filter((item): item is ImportedPlaylistItem => item !== null)
    .map((item, index) => ({
      ...item,
      orderIndex: index,
    }))

  return {
    sourceAdapterId: 'enps-text-htm',
    title: inferPlaylistTitle(input),
    items,
  }
}

function splitIntoSections(html: string) {
  const sections: Array<{ anchor: string; html: string }> = []
  const matches = Array.from(html.matchAll(SECTION_SPLIT))

  for (let index = 0; index < matches.length; index += 1) {
    const current = matches[index]
    const next = matches[index + 1]
    const anchor = (current[1] ?? current[2] ?? current[3] ?? `section-${index}`).trim()

    if (!anchor || IRRELEVANT_ANCHOR_PATTERNS.some((pattern) => pattern.test(anchor))) {
      continue
    }

    const start = (current.index ?? 0) + current[0].length
    const end = next?.index ?? html.length
    sections.push({
      anchor,
      html: html.slice(start, end),
    })
  }

  return sections
}

function parseSection(anchor: string, sectionHtml: string, orderIndex: number): ImportedPlaylistItem | null {
  const lines = extractMeaningfulLines(sectionHtml)

  if (lines.length === 0) {
    return null
  }

  const [title, ...rest] = lines

  return {
    externalId: anchor,
    anchor,
    slug: slugify(anchor),
    title,
    intro: rest[0],
    orderIndex,
  }
}

function extractMeaningfulLines(sectionHtml: string) {
  const normalized = sectionHtml
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(div|p|li|tr|td|h1|h2|h3|h4|h5|h6)>/gi, '$&\n')
  const text = stripHtml(normalized)

  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !IRRELEVANT_LINE_PATTERNS.some((pattern) => pattern.test(line)))
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
