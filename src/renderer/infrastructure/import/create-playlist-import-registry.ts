import { PlaylistSourceAdapterRegistry } from '../../application/playlist-source-adapter-registry'
import { EnpsGraphicalHtmAdapter } from './enps-graphical-htm-adapter'
import { EnpsTextHtmAdapter } from './enps-text-htm-adapter'

export function createPlaylistImportRegistry() {
  const registry = new PlaylistSourceAdapterRegistry()

  registry.register(new EnpsGraphicalHtmAdapter())
  registry.register(new EnpsTextHtmAdapter())

  return registry
}
