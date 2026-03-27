import type { CreatePlaylistPayload, ImportPlaylistFilePayload } from '@shared/plasma-api'

export const plasmaPlaylistsApi = {
  list() {
    return window.plasma.playlists.list()
  },
  create(payload: CreatePlaylistPayload) {
    return window.plasma.playlists.create(payload)
  },
  importFile(payload: ImportPlaylistFilePayload) {
    return window.plasma.playlists.importFile(payload)
  },
}
