export interface PlaylistImportInput {
  fileName: string
  mimeType: string
  textContent?: string
  binaryContent?: Uint8Array
}

export interface ImportedPlaylistItem {
  externalId: string
  title: string
  orderIndex: number
  slug?: string
  anchor?: string
  intro?: string
}

export interface ImportedPlaylist {
  sourceAdapterId: string
  title: string
  items: ImportedPlaylistItem[]
}

export interface PlaylistSourceAdapter {
  id: string
  priority: number
  canHandle(input: PlaylistImportInput): boolean
  importPlaylist(input: PlaylistImportInput): Promise<ImportedPlaylist>
}

export function normalizeImportedPlaylist(playlist: ImportedPlaylist): ImportedPlaylist {
  return {
    ...playlist,
    title: playlist.title.trim(),
    items: [...playlist.items]
      .sort((left, right) => left.orderIndex - right.orderIndex)
      .map((item, index) => ({
        ...item,
        title: item.title.trim(),
        orderIndex: index,
      })),
  }
}
