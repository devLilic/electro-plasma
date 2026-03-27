import type { LocalLibraryStore } from '@domain/local-library-store'
import type { PlaylistImportInput } from '@domain/playlist-import'
import { PlaylistSourceAdapterRegistry } from '@application/playlist-source-adapter-registry'

export interface ImportPlaylistResult {
  playlistId: string
  itemCount: number
  sourceAdapterId: string
}

export class ImportPlaylistService {
  constructor(
    private readonly registry: Pick<PlaylistSourceAdapterRegistry, 'import'>,
    private readonly store: LocalLibraryStore,
    private readonly clock: () => string = () => new Date().toISOString(),
  ) {}

  async import(input: PlaylistImportInput): Promise<ImportPlaylistResult> {
    const imported = await this.registry.import(input)
    const current = await this.store.read()
    const playlistId = createImportedPlaylistId(input.fileName)
    const timestamp = this.clock()

    const existingPlaylist = current.playlists.find((playlist) => playlist.id === playlistId)
    const nextPlaylist = existingPlaylist
      ? {
          ...existingPlaylist,
          name: imported.title,
          updatedAt: timestamp,
        }
      : {
          id: playlistId,
          name: imported.title,
          createdAt: timestamp,
          updatedAt: timestamp,
        }

    const nextPlaylists = current.playlists.some((playlist) => playlist.id === playlistId)
      ? current.playlists.map((playlist) => playlist.id === playlistId ? nextPlaylist : playlist)
      : [...current.playlists, nextPlaylist]

    const remainingItems = current.playlistItems.filter((item) => item.playlistId !== playlistId)
    const importedItems = imported.items.map((item) => ({
      id: createImportedPlaylistItemId(playlistId, item.externalId),
      playlistId,
      title: item.title,
      orderIndex: item.orderIndex,
      visual: { slots: [] },
      tags: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    }))

    await this.store.write({
      ...current,
      playlists: nextPlaylists,
      playlistItems: [...remainingItems, ...importedItems],
    })

    return {
      playlistId,
      itemCount: importedItems.length,
      sourceAdapterId: imported.sourceAdapterId,
    }
  }
}

export function createImportedPlaylistId(fileName: string) {
  return `imported:${slugify(fileName.replace(/\.[^.]+$/, ''))}`
}

function createImportedPlaylistItemId(playlistId: string, externalId: string) {
  return `${playlistId}:${slugify(externalId)}`
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
