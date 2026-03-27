import { afterEach, describe, expect, test } from 'vitest'
import { MAX_ITEM_IMAGES } from '../../src/renderer/domain/media-library'
import { LocalImageAssetService } from '../../src/renderer/infrastructure/local-assets/local-image-asset-service'
import { SqliteLocalDatabase } from '../../src/renderer/infrastructure/local-data/sqlite-local-database'
import { SqlitePlaylistRepository } from '../../src/renderer/infrastructure/local-data/sqlite-playlist-repository'
import { createLocalDatabaseFixture } from '../fixtures/local-database-fixture'
import { createLocalImageFixture } from '../fixtures/local-image-fixture'

const databaseFixtures: Array<{ cleanup(): Promise<void> }> = []
const imageFixtures: Array<{ cleanup(): Promise<void> }> = []

afterEach(async () => {
  await Promise.all(databaseFixtures.splice(0).map((fixture) => fixture.cleanup()))
  await Promise.all(imageFixtures.splice(0).map((fixture) => fixture.cleanup()))
})

describe('item image attachment', () => {
  test('creates an ImageAsset through the asset service and attaches it to an item', async () => {
    const databaseFixture = await createLocalDatabaseFixture()
    const imageFixture = await createLocalImageFixture()
    databaseFixtures.push(databaseFixture)
    imageFixtures.push(imageFixture)

    const sourceFilePath = await imageFixture.createSourceImage('item-one.png', 'image-one')
    const assetService = new LocalImageAssetService(imageFixture.storageDir)
    const database = new SqliteLocalDatabase(databaseFixture.databaseFilePath)
    const repository = new SqlitePlaylistRepository(database)

    await repository.createPlaylist({ id: 'playlist-1', name: 'Image playlist' })
    await repository.createPlaylistItem({
      id: 'item-1',
      playlistId: 'playlist-1',
      title: 'Hero shot',
      orderIndex: 0,
    })

    const imageAsset = await assetService.importImage({ sourceFilePath })
    await repository.attachImageToItem({ itemId: 'item-1', image: imageAsset })

    const playlist = await repository.getPlaylist('playlist-1')
    expect(playlist?.items[0]?.visual.slots[0]?.image).toMatchObject({
      id: imageAsset.id,
      path: imageAsset.path,
      originalPath: imageAsset.originalPath,
      processedPath: imageAsset.processedPath,
      previewPath: imageAsset.previewPath,
      mimeType: 'image/png',
    })
    database.close()
  })

  test('enforces the max 5 images per item and keeps reorder stable', async () => {
    const databaseFixture = await createLocalDatabaseFixture()
    const imageFixture = await createLocalImageFixture()
    databaseFixtures.push(databaseFixture)
    imageFixtures.push(imageFixture)

    const assetService = new LocalImageAssetService(imageFixture.storageDir)
    const database = new SqliteLocalDatabase(databaseFixture.databaseFilePath)
    const repository = new SqlitePlaylistRepository(database)

    await repository.createPlaylist({ id: 'playlist-1', name: 'Image playlist' })
    await repository.createPlaylistItem({
      id: 'item-1',
      playlistId: 'playlist-1',
      title: 'Hero shot',
      orderIndex: 0,
    })

    const attachedImageIds: string[] = []
    for (let index = 1; index <= MAX_ITEM_IMAGES; index += 1) {
      const sourceFilePath = await imageFixture.createSourceImage(`image-${index}.png`, `image-${index}`)
      const imageAsset = await assetService.importImage({ sourceFilePath })
      attachedImageIds.push(imageAsset.id)
      await repository.attachImageToItem({ itemId: 'item-1', image: imageAsset })
    }

    const overflowSourceFilePath = await imageFixture.createSourceImage('image-6.png', 'image-6')
    const overflowAsset = await assetService.importImage({ sourceFilePath: overflowSourceFilePath })

    await expect(
      repository.attachImageToItem({ itemId: 'item-1', image: overflowAsset }),
    ).rejects.toThrow(`maximum of ${MAX_ITEM_IMAGES} images`)

    await repository.reorderItemImages('item-1', [
      attachedImageIds[4]!,
      attachedImageIds[0]!,
      attachedImageIds[1]!,
      attachedImageIds[2]!,
      attachedImageIds[3]!,
    ])

    const playlist = await repository.getPlaylist('playlist-1')
    expect(playlist?.items[0]?.visual.slots.map((slot) => slot.image.id)).toEqual([
      attachedImageIds[4],
      attachedImageIds[0],
      attachedImageIds[1],
      attachedImageIds[2],
      attachedImageIds[3],
    ])
    expect(playlist?.items[0]?.visual.slots.map((slot) => slot.slotIndex)).toEqual([0, 1, 2, 3, 4])
    database.close()
  })
})
