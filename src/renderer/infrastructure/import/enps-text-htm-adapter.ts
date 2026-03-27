import type {
  ImportedPlaylist,
  PlaylistImportInput,
  PlaylistSourceAdapter,
} from '../../domain/playlist-import'
import { isHtmImport } from './enps-import-helpers'
import { parseEnpsTextHtm } from './enps-text-htm-parser'

export class EnpsTextHtmAdapter implements PlaylistSourceAdapter {
  readonly id = 'enps-text-htm'
  readonly priority = 100

  canHandle(input: PlaylistImportInput) {
    if (!isHtmImport(input)) {
      return false
    }

    const textContent = input.textContent ?? ''
    return !/<img\b/i.test(textContent)
  }

  async importPlaylist(input: PlaylistImportInput): Promise<ImportedPlaylist> {
    return parseEnpsTextHtm(input)
  }
}
