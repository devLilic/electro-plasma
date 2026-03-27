import { describe, expect, test } from 'vitest'
import { PlaylistSourceAdapterRegistry } from '../../src/renderer/application/playlist-source-adapter-registry'
import { createPlaylistImportRegistry } from '../../src/renderer/infrastructure/import/create-playlist-import-registry'
import { EnpsGraphicalHtmAdapter } from '../../src/renderer/infrastructure/import/enps-graphical-htm-adapter'
import { EnpsTextHtmAdapter } from '../../src/renderer/infrastructure/import/enps-text-htm-adapter'
import type {
  ImportedPlaylist,
  PlaylistImportInput,
  PlaylistSourceAdapter,
} from '../../src/renderer/domain/playlist-import'
import {
  createGraphicalHtmInput,
  createM3uInput,
  createTextOnlyHtmInput,
} from '../fixtures/playlist-import-fixture'

function createAdapter(
  adapter: Partial<PlaylistSourceAdapter> & Pick<PlaylistSourceAdapter, 'id'>,
): PlaylistSourceAdapter {
  return {
    priority: 0,
    canHandle: () => false,
    importPlaylist: async () => ({ sourceAdapterId: adapter.id, title: '', items: [] }),
    ...adapter,
  }
}

describe('playlist source adapter registry', () => {
  test('registers adapters and resolves the correct one', () => {
    const registry = new PlaylistSourceAdapterRegistry()
    const m3uAdapter = createAdapter({
      id: 'm3u',
      priority: 10,
      canHandle: (input) => input.fileName.endsWith('.m3u'),
    })

    registry.register(m3uAdapter)

    expect(registry.list()).toHaveLength(1)
    expect(registry.resolve(createM3uInput()).id).toBe('m3u')
  })

  test('normalizes imported output regardless of source ordering', async () => {
    const registry = new PlaylistSourceAdapterRegistry()
    registry.register(createAdapter({
      id: 'm3u',
      priority: 10,
      canHandle: (input) => input.fileName.endsWith('.m3u'),
      importPlaylist: async (): Promise<ImportedPlaylist> => ({
        sourceAdapterId: 'ignored',
        title: '  Imported M3U  ',
        items: [
          { externalId: 'b', title: '  Second Song  ', orderIndex: 5 },
          { externalId: 'a', title: ' First Song ', orderIndex: 1 },
        ],
      }),
    }))

    const imported = await registry.import(createM3uInput())

    expect(imported).toEqual({
      sourceAdapterId: 'm3u',
      title: 'Imported M3U',
      items: [
        { externalId: 'a', title: 'First Song', orderIndex: 0 },
        { externalId: 'b', title: 'Second Song', orderIndex: 1 },
      ],
    })
  })

  test('prefers the text-only htm adapter variant when multiple adapters match', async () => {
    const registry = new PlaylistSourceAdapterRegistry()
    registry.register(createAdapter({
      id: 'htm-generic',
      priority: 10,
      canHandle: (input) => input.fileName.endsWith('.htm'),
      importPlaylist: async () => ({
        sourceAdapterId: 'htm-generic',
        title: 'Generic',
        items: [{ externalId: '1', title: 'Generic item', orderIndex: 0 }],
      }),
    }))
    registry.register(createAdapter({
      id: 'htm-text-only',
      priority: 100,
      canHandle: (input) => (
        input.fileName.endsWith('.htm')
        && input.mimeType === 'text/html'
        && typeof input.textContent === 'string'
        && input.textContent.length > 0
      ),
      importPlaylist: async () => ({
        sourceAdapterId: 'htm-text-only',
        title: 'Text Only',
        items: [{ externalId: '1', title: 'Text item', orderIndex: 0 }],
      }),
    }))

    const imported = await registry.import(createTextOnlyHtmInput())

    expect(imported.sourceAdapterId).toBe('htm-text-only')
    expect(imported.title).toBe('Text Only')
  })

  test('throws when no adapter can handle the input', () => {
    const registry = new PlaylistSourceAdapterRegistry()
    const unsupportedInput: PlaylistImportInput = {
      fileName: 'playlist.bin',
      mimeType: 'application/octet-stream',
      binaryContent: new Uint8Array([1, 2, 3]),
    }

    expect(() => registry.resolve(unsupportedInput)).toThrow('No playlist source adapter can handle')
  })

  test('text-only ENPS adapter normalizes text html into playlist items', async () => {
    const adapter = new EnpsTextHtmAdapter()

    expect(adapter.canHandle(createTextOnlyHtmInput())).toBe(true)

    const imported = await adapter.importPlaylist(createTextOnlyHtmInput())

    expect(imported).toEqual({
      sourceAdapterId: 'enps-text-htm',
      title: 'Morning rundown',
      items: [
        {
          externalId: 'OPENING_HEADLINES',
          anchor: 'OPENING_HEADLINES',
          slug: 'opening-headlines',
          title: 'OPENING HEADLINES',
          intro: 'Top lines for the show',
          orderIndex: 0,
        },
        {
          externalId: 'WEATHER_BRIEF',
          anchor: 'WEATHER_BRIEF',
          slug: 'weather-brief',
          title: 'WEATHER BRIEF',
          intro: 'Cold front over the north',
          orderIndex: 1,
        },
      ],
    })
  })

  test('graphical ENPS adapter acts as fallback for htm with graphics', async () => {
    const adapter = new EnpsGraphicalHtmAdapter()

    expect(adapter.canHandle(createGraphicalHtmInput())).toBe(true)

    const imported = await adapter.importPlaylist(createGraphicalHtmInput())

    expect(imported).toEqual({
      sourceAdapterId: 'enps-graphical-htm',
      title: 'Graphic Rundown',
      items: [
        {
          externalId: 'LOWER_THIRD_GRAPHIC',
          anchor: 'LOWER_THIRD_GRAPHIC',
          slug: 'lower-third-graphic',
          title: 'Lower Third Graphic',
          intro: 'Anchor Intro',
          orderIndex: 0,
        },
        {
          externalId: 'CLOSING_CREDITS',
          anchor: 'CLOSING_CREDITS',
          slug: 'closing-credits',
          title: 'Closing Credits',
          intro: 'Roll closing names over skyline',
          orderIndex: 1,
        },
      ],
    })
  })

  test('default import registry wires ENPS adapters with text-only priority', async () => {
    const registry = createPlaylistImportRegistry()

    expect(registry.resolve(createTextOnlyHtmInput()).id).toBe('enps-text-htm')
    expect(registry.resolve(createGraphicalHtmInput()).id).toBe('enps-graphical-htm')

    const imported = await registry.import(createTextOnlyHtmInput())
    expect(imported.sourceAdapterId).toBe('enps-text-htm')
  })
})
