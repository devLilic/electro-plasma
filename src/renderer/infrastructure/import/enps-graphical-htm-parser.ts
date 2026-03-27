import type { ImportedPlaylist, ImportedPlaylistItem, PlaylistImportInput } from '../../domain/playlist-import'
import { inferPlaylistTitle, isHtmImport, stripHtml } from './enps-import-helpers'

const IRRELEVANT_GRAPHICAL_LINES = [
  /^page\s+\d+/i,
  /^newsroom\b/i,
  /^marker\b/i,
  /^rundown\b/i,
  /^wire\b/i,
  /^nrcs\b/i,
  /^enps\b/i,
  /^\[.*\]$/,
  /^<{2,}.*>{2,}$/,
]

export function parseEnpsGraphicalHtm(input: PlaylistImportInput): ImportedPlaylist {
  if (!isHtmImport(input)) {
    throw new Error(`Unsupported graphical HTM import: ${input.fileName}`)
  }

  const html = input.textContent ?? ''
  const sections = extractGraphicalSections(html)
  const items = sections
    .map((section, index) => parseGraphicalSection(section, index))
    .filter((item): item is ImportedPlaylistItem => item !== null)
    .map((item, index) => ({
      ...item,
      orderIndex: index,
    }))

  return {
    sourceAdapterId: 'enps-graphical-htm',
    title: inferPlaylistTitle(input),
    items,
  }
}

interface GraphicalSection {
  anchor?: string
  html: string
}

function extractGraphicalSections(html: string): GraphicalSection[] {
  const anchoredSections = splitAnchoredSections(html)
  if (anchoredSections.length > 0) {
    return anchoredSections
  }

  const attributedSections = splitAttributedSections(html)
  if (attributedSections.length > 0) {
    return attributedSections
  }

  const blockMatches = Array.from(
    html.matchAll(/<(div|section|article|tr|li)[^>]*>([\s\S]*?)<\/\1>/gi),
  )

  return blockMatches.map((match, index) => ({
    anchor: extractAnchor(match[2] ?? '') ?? `graphical-section-${index}`,
    html: match[2] ?? '',
  }))
}

function splitAnchoredSections(html: string) {
  const anchorMatches = Array.from(
    html.matchAll(/<a[^>]+(?:name|id)=["']?([^"'\s>]+)["']?[^>]*>\s*<\/a>/gi),
  )
  const sections: GraphicalSection[] = []

  for (let index = 0; index < anchorMatches.length; index += 1) {
    const current = anchorMatches[index]
    const next = anchorMatches[index + 1]
    const start = (current.index ?? 0) + current[0].length
    const end = next?.index ?? html.length
    sections.push({
      anchor: current[1] ?? `section-${index}`,
      html: html.slice(start, end),
    })
  }

  return sections
}

function splitAttributedSections(html: string) {
  const sectionStartMatches = Array.from(
    html.matchAll(/<(div|section|article|tr|li)[^>]*(?:data-anchor|id|name)=["']?([^"'\s>]+)["']?[^>]*>/gi),
  )
  const sections: GraphicalSection[] = []

  for (let index = 0; index < sectionStartMatches.length; index += 1) {
    const current = sectionStartMatches[index]
    const next = sectionStartMatches[index + 1]
    const start = (current.index ?? 0) + current[0].length
    const end = next?.index ?? html.length
    sections.push({
      anchor: current[2] ?? `graphical-section-${index}`,
      html: html.slice(start, end),
    })
  }

  return sections
}

function parseGraphicalSection(section: GraphicalSection, orderIndex: number): ImportedPlaylistItem | null {
  const lines = extractGraphicalLines(section.html)
  if (lines.length === 0) {
    return null
  }

  const imageAlt = extractImageAlt(section.html)
  const anchor = section.anchor ?? slugify(lines[0])
  const title = imageAlt && lines.length > 1 ? lines[0] : (imageAlt ?? lines[0])
  const introCandidate = lines.find((line) => line !== title && line !== imageAlt)

  return {
    externalId: anchor,
    anchor,
    slug: slugify(anchor),
    title,
    intro: introCandidate,
    orderIndex,
  }
}

function extractGraphicalLines(sectionHtml: string) {
  const normalized = sectionHtml
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(div|p|li|tr|td|section|article|span|h1|h2|h3|h4|h5|h6)>/gi, '$&\n')
  const text = stripHtml(normalized)

  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !IRRELEVANT_GRAPHICAL_LINES.some((pattern) => pattern.test(line)))
}

function extractImageAlt(sectionHtml: string) {
  return Array.from(sectionHtml.matchAll(/<img[^>]+alt=['"]([^'"]+)['"][^>]*>/gi))
    .map((match) => stripHtml(match[1] ?? ''))
    .find(Boolean)
}

function extractAnchor(sectionHtml: string) {
  return sectionHtml.match(/(?:data-anchor|id|name)=["']?([^"'\s>]+)["']?/i)?.[1]
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
