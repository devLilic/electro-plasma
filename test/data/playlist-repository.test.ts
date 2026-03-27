import { afterEach, describe, expect, test } from 'vitest'
import { MAX_ITEM_IMAGES } from '../../src/renderer/domain/media-library'
import { SqliteLocalDatabase } from '../../src/renderer/infrastructure/local-data/sqlite-local-database'
import { SqlitePlaylistRepository } from '../../src/renderer/infrastructure/local-data/sqlite-playlist-repository'
import { createLocalDatabaseFixture } from '../fixtures/local-database-fixture'

const fixtures: Array<{ cleanup(): Promise<void> }> = []

afterEach(async () => {
  await Promise.all(fixtures.splice(0).map((fixture) => fixture.cleanup()))
})

function createImageAsset(id: string) {
  return {
    id,
    path: `/library/originals/${id}.png`,
    originalPath: `/library/originals/${id}.png`,
    processedPath: `/library/processed/${id}.png`,
    previewPath: `/library/previews/${id}.png`,
    mimeType: 'image/png',
    createdAt: '2026-03-26T00:00:00.000Z',
  }
}

describe('sqlite playlist repository', () => {
  test('creates a playlist and returns it', async () => {
    const fixture = await createLocalDatabaseFixture()
    fixtures.push(fixture)

    const database = new SqliteLocalDatabase(fixture.databaseFilePath)
    const repository = new SqlitePlaylistRepository(database)
    const playlist = await repository.createPlaylist({ id: 'playlist-1', name: 'Launch visuals' })

    expect(playlist.id).toBe('playlist-1')
    expect(playlist.name).toBe('Launch visuals')
    database.close()
  })

  test('creates ordered items for a playlist', async () => {
    const fixture = await createLocalDatabaseFixture()
    fixtures.push(fixture)

    const database = new SqliteLocalDatabase(fixture.databaseFilePath)
    const repository = new SqlitePlaylistRepository(database)
    await repository.createPlaylist({ id: 'playlist-1', name: 'Ordered set' })
    await repository.createPlaylistItem({
      id: 'item-2',
      playlistId: 'playlist-1',
      title: 'Second',
      orderIndex: 2,
    })
    await repository.createPlaylistItem({
      id: 'item-1',
      playlistId: 'playlist-1',
      title: 'First',
      orderIndex: 1,
    })

    const playlist = await repository.getPlaylist('playlist-1')

    expect(playlist?.items.map((item) => item.id)).toEqual(['item-1', 'item-2'])
    database.close()
  })

  test('attaches images to an item and enforces the 5 image limit', async () => {
    const fixture = await createLocalDatabaseFixture()
    fixtures.push(fixture)

    const database = new SqliteLocalDatabase(fixture.databaseFilePath)
    const repository = new SqlitePlaylistRepository(database)
    await repository.createPlaylist({ id: 'playlist-1', name: 'Image set' })
    await repository.createPlaylistItem({
      id: 'item-1',
      playlistId: 'playlist-1',
      title: 'Hero frame',
      orderIndex: 1,
    })

    for (let index = 1; index <= MAX_ITEM_IMAGES; index += 1) {
      await repository.attachImageToItem({
        itemId: 'item-1',
        image: createImageAsset(`image-${index}`),
      })
    }

    const playlist = await repository.getPlaylist('playlist-1')
    expect(playlist?.items[0]?.visual.slots).toHaveLength(MAX_ITEM_IMAGES)
    expect(playlist?.items[0]?.visual.slots.map((slot) => slot.slotIndex)).toEqual([0, 1, 2, 3, 4])

    await expect(
      repository.attachImageToItem({
        itemId: 'item-1',
        image: createImageAsset('image-6'),
      }),
    ).rejects.toThrow(`maximum of ${MAX_ITEM_IMAGES} images`)
    database.close()
  })

  test('reorders item images and persists the new order after reload', async () => {
    const fixture = await createLocalDatabaseFixture()
    fixtures.push(fixture)

    const database = new SqliteLocalDatabase(fixture.databaseFilePath)
    const repository = new SqlitePlaylistRepository(database)
    await repository.createPlaylist({ id: 'playlist-1', name: 'Reload set' })
    await repository.createPlaylistItem({
      id: 'item-1',
      playlistId: 'playlist-1',
      title: 'Scene 1',
      orderIndex: 1,
    })

    for (const imageId of ['image-a', 'image-b', 'image-c']) {
      await repository.attachImageToItem({
        itemId: 'item-1',
        image: createImageAsset(imageId),
      })
    }

    await repository.reorderItemImages('item-1', ['image-c', 'image-a', 'image-b'])

    database.close()
    const reloadedDatabase = new SqliteLocalDatabase(fixture.databaseFilePath)
    const reloadedRepository = new SqlitePlaylistRepository(reloadedDatabase)
    const playlist = await reloadedRepository.getPlaylist('playlist-1')

    expect(playlist?.items[0]?.visual.slots.map((slot) => slot.image.id)).toEqual([
      'image-c',
      'image-a',
      'image-b',
    ])
    expect(playlist?.items[0]?.visual.slots.map((slot) => slot.slotIndex)).toEqual([0, 1, 2])
    reloadedDatabase.close()
  })

  test('updates slot activity, slideshow and transition settings', async () => {
    const fixture = await createLocalDatabaseFixture()
    fixtures.push(fixture)

    const database = new SqliteLocalDatabase(fixture.databaseFilePath)
    const repository = new SqlitePlaylistRepository(database)
    await repository.createPlaylist({ id: 'playlist-1', name: 'Configurable slots' })
    await repository.createPlaylistItem({
      id: 'item-1',
      playlistId: 'playlist-1',
      title: 'Scene 1',
      orderIndex: 1,
    })
    await repository.attachImageToItem({
      itemId: 'item-1',
      image: createImageAsset('image-a'),
    })

    await repository.updateItemVisualSlot({
      itemId: 'item-1',
      imageId: 'image-a',
      isActive: false,
      slideshow: {
        enabled: true,
        intervalMs: 5000,
      },
      transition: {
        type: 'slide',
        durationMs: 900,
      },
    })

    const playlist = await repository.getPlaylist('playlist-1')
    expect(playlist?.items[0]?.visual.slots[0]).toMatchObject({
      slotIndex: 0,
      isActive: false,
      slideshow: {
        enabled: true,
        intervalMs: 5000,
      },
      transition: {
        type: 'slide',
        durationMs: 900,
      },
    })
    database.close()
  })

  test('rejects invalid slideshow settings for a slot', async () => {
    const fixture = await createLocalDatabaseFixture()
    fixtures.push(fixture)

    const database = new SqliteLocalDatabase(fixture.databaseFilePath)
    const repository = new SqlitePlaylistRepository(database)
    await repository.createPlaylist({ id: 'playlist-1', name: 'Invalid slot config' })
    await repository.createPlaylistItem({
      id: 'item-1',
      playlistId: 'playlist-1',
      title: 'Scene 1',
      orderIndex: 1,
    })
    await repository.attachImageToItem({
      itemId: 'item-1',
      image: createImageAsset('image-a'),
    })

    await expect(
      repository.updateItemVisualSlot({
        itemId: 'item-1',
        imageId: 'image-a',
        isActive: true,
        slideshow: {
          enabled: true,
          intervalMs: 0,
        },
        transition: {
          type: 'fade',
          durationMs: 300,
        },
      }),
    ).rejects.toThrow('Enabled slideshow slots require a positive interval.')
    database.close()
  })
})
