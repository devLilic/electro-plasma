import type {
  ImportedPlaylist,
  PlaylistImportInput,
  PlaylistSourceAdapter,
} from '../../domain/playlist-import'
import { isHtmImport } from './enps-import-helpers'
import { parseEnpsGraphicalHtm } from './enps-graphical-htm-parser'

export class EnpsGraphicalHtmAdapter implements PlaylistSourceAdapter {
  readonly id = 'enps-graphical-htm'
  readonly priority = 10

  canHandle(input: PlaylistImportInput) {
    return isHtmImport(input)
  }

  async importPlaylist(input: PlaylistImportInput): Promise<ImportedPlaylist> {
    return parseEnpsGraphicalHtm(input)
  }
}
