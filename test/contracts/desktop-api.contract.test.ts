import { describe, expect, test } from 'vitest'
import {
  PLASMA_API_NAMESPACE,
  assertSerializable,
  plasmaApiContract,
  validateActivateItemPayload,
  validateApplyImageProcessingPayload,
  validateCreatePlaylistPayload,
  validateDownloadSearchSelectionPayload,
  validateImportLocalAssetsPayload,
  validateImportPlaylistFilePayload,
  validateSearchImagesPayload,
} from '../../src/shared/plasma-api'

describe('plasma api contract', () => {
  test('uses a stable renderer namespace', () => {
    expect(PLASMA_API_NAMESPACE).toBe('plasma')
  })

  test('exposes the typed preload surface for renderer-electron orchestration', () => {
    expect(Object.keys(plasmaApiContract)).toEqual([
      'app',
      'playlists',
      'assets',
      'imageProcessing',
      'playout',
      'externalControl',
    ])
    expect(plasmaApiContract.app).toEqual(['getVersion'])
    expect(plasmaApiContract.playlists).toEqual(['list', 'create', 'importFile'])
    expect(plasmaApiContract.assets).toEqual(['importLocalImages', 'searchImages', 'downloadSearchSelection'])
    expect(plasmaApiContract.imageProcessing).toEqual(['applyTransforms'])
    expect(plasmaApiContract.playout).toEqual([
      'getStatus',
      'play',
      'next',
      'stop',
      'pause',
      'resume',
      'previous',
      'activateItem',
      'subscribe',
    ])
    expect(plasmaApiContract.externalControl).toEqual(['getStatus', 'subscribe'])
  })

  test('validates IPC payloads before they cross preload', () => {
    expect(() => validateImportPlaylistFilePayload({ filePath: 'C:/news/rundown.htm' })).not.toThrow()
    expect(() => validateCreatePlaylistPayload({ id: 'playlist:morning', name: 'Morning News' })).not.toThrow()
    expect(() => validateImportLocalAssetsPayload({
      itemId: 'item:1',
      sourceFilePaths: ['C:/images/hero.png'],
    })).not.toThrow()
    expect(() => validateSearchImagesPayload({ query: 'breaking news', limit: 5 })).not.toThrow()
    expect(() => validateDownloadSearchSelectionPayload({
      selectedResults: [{
        id: 'image-1',
        provider: 'wikimedia-commons',
        title: 'Skyline',
        previewUrl: 'https://example.com/preview.jpg',
        downloadUrl: 'https://example.com/download.jpg',
        sourceUrl: 'https://example.com/source',
        width: 1920,
        height: 1080,
      }],
    })).not.toThrow()
    expect(() => validateApplyImageProcessingPayload({
      assetId: 'image:1',
      operations: [{ type: 'rotate', degrees: 90 }],
    })).not.toThrow()
    expect(() => validateActivateItemPayload({ itemId: 'item:hero' })).not.toThrow()

    expect(() => validateImportPlaylistFilePayload({ filePath: '   ' })).toThrow('Playlist import requires a file path.')
    expect(() => validateCreatePlaylistPayload({ id: ' ', name: 'Morning News' })).toThrow('Playlist creation requires an id.')
    expect(() => validateImportLocalAssetsPayload({ itemId: 'item:1', sourceFilePaths: [] }))
      .toThrow('Asset import requires at least one local file path.')
    expect(() => validateSearchImagesPayload({ query: 'skyline', limit: 0 }))
      .toThrow('Image search limit must be an integer between 1 and 25.')
    expect(() => validateDownloadSearchSelectionPayload({ selectedResults: [] }))
      .toThrow('Search selection must contain between 1 and 5 images.')
    expect(() => validateApplyImageProcessingPayload({
      assetId: 'image:1',
      operations: [{ type: 'rotate', degrees: 45 as 90 }],
    })).toThrow('Rotate operations support only 90, 180 or 270 degrees.')
    expect(() => validateActivateItemPayload({ itemId: '   ' })).toThrow('Playout activateItem requires an item id.')
  })

  test('keeps IPC dto payloads serializable', () => {
    expect(() => assertSerializable({
      playlistId: 'playlist:morning',
      assets: [
        { id: 'image:1', width: 1920, height: 1080 },
      ],
      externalControl: {
        enabled: false,
        provider: 'local-http',
        activityState: 'listening',
        endpointUrl: 'http://127.0.0.1:45870',
        port: 45870,
        allowedCommands: ['play', 'next', 'stop'],
        lastCommand: 'play',
        recentCommands: [
          {
            command: 'play',
            receivedAt: '2026-03-26T12:00:00.000Z',
            source: 'local-http',
          },
        ],
      },
    })).not.toThrow()

    expect(() => assertSerializable({
      now: new Date(),
    })).toThrow('IPC payloads and DTOs must stay serializable.')
  })
})
