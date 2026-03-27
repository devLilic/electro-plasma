import type { PlaylistImportInput } from '../../domain/playlist-import'

export function isHtmImport(input: PlaylistImportInput) {
  const fileName = input.fileName.toLowerCase()
  return (
    (fileName.endsWith('.htm') || fileName.endsWith('.html'))
    && input.mimeType === 'text/html'
    && typeof input.textContent === 'string'
  )
}

export function inferPlaylistTitle(input: PlaylistImportInput) {
  const fromTitle = input.textContent?.match(/<title>(.*?)<\/title>/is)?.[1]?.trim()
  if (fromTitle) {
    return fromTitle
  }

  return input.fileName.replace(/\.[^.]+$/, '')
}

export function extractTextBlocks(textContent: string) {
  const blockMatches = Array.from(
    textContent.matchAll(/<(div|p|li|td|span)[^>]*>(.*?)<\/\1>/gis),
  )

  return blockMatches
    .map((match) => stripHtml(match[2] ?? ''))
    .map((value) => value.trim())
    .filter(Boolean)
}

export function stripHtml(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .trim()
}
