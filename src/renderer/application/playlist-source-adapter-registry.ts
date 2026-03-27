import {
  normalizeImportedPlaylist,
  type ImportedPlaylist,
  type PlaylistImportInput,
  type PlaylistSourceAdapter,
} from '@domain/playlist-import'

export class PlaylistSourceAdapterRegistry {
  private readonly adapters: PlaylistSourceAdapter[] = []

  register(adapter: PlaylistSourceAdapter) {
    this.adapters.push(adapter)
  }

  list() {
    return [...this.adapters]
  }

  resolve(input: PlaylistImportInput) {
    const adapter = this.adapters
      .filter((entry) => entry.canHandle(input))
      .sort((left, right) => right.priority - left.priority)[0]

    if (!adapter) {
      throw new Error(`No playlist source adapter can handle ${input.fileName}`)
    }

    return adapter
  }

  async import(input: PlaylistImportInput): Promise<ImportedPlaylist> {
    const adapter = this.resolve(input)
    const playlist = await adapter.importPlaylist(input)

    return normalizeImportedPlaylist({
      ...playlist,
      sourceAdapterId: adapter.id,
    })
  }
}
