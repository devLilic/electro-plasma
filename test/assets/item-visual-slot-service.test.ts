import { afterEach, describe, expect, test } from 'vitest'
import { ItemVisualSlotService } from '../../src/renderer/application/item-visual-slot-service'
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

describe('item visual slot service', () => {
  test('creates slots and keeps their order stable', async () => {
    const databaseFixture = await createLocalDatabaseFixture()
    const imageFixture = await createLocalImageFixture()
    databaseFixtures.push(databaseFixture)
    imageFixtures.push(imageFixture)

    const database = new SqliteLocalDatabase(databaseFixture.databaseFilePath)
    const repository = new SqlitePlaylistRepository(database)
    const assetService = new LocalImageAssetService(imageFixture.storageDir)
    const slotService = new ItemVisualSlotService(database, assetService, () => '2026-03-26T12:00:00.000Z')

    await repository.createPlaylist({ id: 'playlist-1', name: 'Slots' })
    await repository.createPlaylistItem({
      id: 'item-1',
      playlistId: 'playlist-1',
      title: 'Visual item',
      orderIndex: 0,
    })

    for (const [index, name] of ['one', 'two', 'three'].entries()) {
      const sourceFilePath = await imageFixture.createSourceImage(`${name}.png`, `image-${index}`)
      await slotService.createSlot({ itemId: 'item-1', sourceFilePath })
    }

    const playlist = await repository.getPlaylist('playlist-1')
    expect(playlist?.items[0]?.visual.slots.map((slot) => slot.slotIndex)).toEqual([0, 1, 2])
    database.close()
  })

  test('replaces a slot image while preserving its position and settings', async () => {
    const databaseFixture = await createLocalDatabaseFixture()
    const imageFixture = await createLocalImageFixture()
    databaseFixtures.push(databaseFixture)
    imageFixtures.push(imageFixture)

    const database = new SqliteLocalDatabase(databaseFixture.databaseFilePath)
    const repository = new SqlitePlaylistRepository(database)
    const assetService = new LocalImageAssetService(imageFixture.storageDir)
    const slotService = new ItemVisualSlotService(database, assetService, () => '2026-03-26T12:00:00.000Z')

    await repository.createPlaylist({ id: 'playlist-1', name: 'Slots' })
    await repository.createPlaylistItem({
      id: 'item-1',
      playlistId: 'playlist-1',
      title: 'Visual item',
      orderIndex: 0,
    })

    const firstPath = await imageFixture.createSourceImage('first.png', 'first')
    const secondPath = await imageFixture.createSourceImage('second.png', 'second')
    const originalItem = await slotService.createSlot({ itemId: 'item-1', sourceFilePath: firstPath })
    const originalSlot = originalItem.visual.slots[0]!

    await slotService.updateSlotSettings({
      itemId: 'item-1',
      imageId: originalSlot.image.id,
      isActive: false,
      slideshow: { enabled: true, intervalMs: 4000 },
      transition: { type: 'slide', durationMs: 800 },
    })

    const replacedItem = await slotService.replaceSlot({
      itemId: 'item-1',
      imageId: originalSlot.image.id,
      sourceFilePath: secondPath,
    })

    expect(replacedItem.visual.slots[0]).toMatchObject({
      slotIndex: 0,
      isActive: false,
      slideshow: { enabled: true, intervalMs: 4000 },
      transition: { type: 'slide', durationMs: 800 },
    })
    expect(replacedItem.visual.slots[0]?.image.id).not.toBe(originalSlot.image.id)
    database.close()
  })

  test('deletes a slot and compacts indexes', async () => {
    const databaseFixture = await createLocalDatabaseFixture()
    const imageFixture = await createLocalImageFixture()
    databaseFixtures.push(databaseFixture)
    imageFixtures.push(imageFixture)

    const database = new SqliteLocalDatabase(databaseFixture.databaseFilePath)
    const repository = new SqlitePlaylistRepository(database)
    const assetService = new LocalImageAssetService(imageFixture.storageDir)
    const slotService = new ItemVisualSlotService(database, assetService)

    await repository.createPlaylist({ id: 'playlist-1', name: 'Slots' })
    await repository.createPlaylistItem({
      id: 'item-1',
      playlistId: 'playlist-1',
      title: 'Visual item',
      orderIndex: 0,
    })

    const slotIds: string[] = []
    for (const name of ['one', 'two', 'three']) {
      const sourceFilePath = await imageFixture.createSourceImage(`${name}.png`, name)
      const item = await slotService.createSlot({ itemId: 'item-1', sourceFilePath })
      slotIds.splice(0, slotIds.length, ...item.visual.slots.map((slot) => slot.image.id))
    }

    const itemAfterDelete = await slotService.deleteSlot({ itemId: 'item-1', imageId: slotIds[1]! })
    expect(itemAfterDelete.visual.slots.map((slot) => slot.slotIndex)).toEqual([0, 1])
    expect(itemAfterDelete.visual.slots.map((slot) => slot.image.id)).toEqual([slotIds[0], slotIds[2]])
    database.close()
  })

  test('moves slots left and right with boundary-safe behavior', async () => {
    const databaseFixture = await createLocalDatabaseFixture()
    const imageFixture = await createLocalImageFixture()
    databaseFixtures.push(databaseFixture)
    imageFixtures.push(imageFixture)

    const database = new SqliteLocalDatabase(databaseFixture.databaseFilePath)
    const repository = new SqlitePlaylistRepository(database)
    const assetService = new LocalImageAssetService(imageFixture.storageDir)
    const slotService = new ItemVisualSlotService(database, assetService)

    await repository.createPlaylist({ id: 'playlist-1', name: 'Slots' })
    await repository.createPlaylistItem({
      id: 'item-1',
      playlistId: 'playlist-1',
      title: 'Visual item',
      orderIndex: 0,
    })

    let item = null as Awaited<ReturnType<typeof slotService.createSlot>> | null
    for (const name of ['one', 'two', 'three']) {
      const sourceFilePath = await imageFixture.createSourceImage(`${name}.png`, name)
      item = await slotService.createSlot({ itemId: 'item-1', sourceFilePath })
    }

    const middleId = item!.visual.slots[1]!.image.id
    const leftMoved = await slotService.moveSlotLeft({ itemId: 'item-1', imageId: middleId })
    expect(leftMoved.visual.slots.map((slot) => slot.image.id)[0]).toBe(middleId)

    const leftEdgeId = leftMoved.visual.slots[0]!.image.id
    const unchanged = await slotService.moveSlotLeft({ itemId: 'item-1', imageId: leftEdgeId })
    expect(unchanged.visual.slots.map((slot) => slot.image.id)).toEqual(
      leftMoved.visual.slots.map((slot) => slot.image.id),
    )

    const movedRight = await slotService.moveSlotRight({ itemId: 'item-1', imageId: leftEdgeId })
    expect(movedRight.visual.slots.map((slot) => slot.image.id)[1]).toBe(leftEdgeId)
    database.close()
  })

  test('updates per-slot settings and enforces the 5 image cap through service', async () => {
    const databaseFixture = await createLocalDatabaseFixture()
    const imageFixture = await createLocalImageFixture()
    databaseFixtures.push(databaseFixture)
    imageFixtures.push(imageFixture)

    const database = new SqliteLocalDatabase(databaseFixture.databaseFilePath)
    const repository = new SqlitePlaylistRepository(database)
    const assetService = new LocalImageAssetService(imageFixture.storageDir)
    const slotService = new ItemVisualSlotService(database, assetService)

    await repository.createPlaylist({ id: 'playlist-1', name: 'Slots' })
    await repository.createPlaylistItem({
      id: 'item-1',
      playlistId: 'playlist-1',
      title: 'Visual item',
      orderIndex: 0,
    })

    let item = null as Awaited<ReturnType<typeof slotService.createSlot>> | null
    for (let index = 1; index <= MAX_ITEM_IMAGES; index += 1) {
      const sourceFilePath = await imageFixture.createSourceImage(`${index}.png`, `${index}`)
      item = await slotService.createSlot({ itemId: 'item-1', sourceFilePath })
    }

    await expect(
      slotService.createSlot({
        itemId: 'item-1',
        sourceFilePath: await imageFixture.createSourceImage('overflow.png', 'overflow'),
      }),
    ).rejects.toThrow(`maximum of ${MAX_ITEM_IMAGES} images`)

    const firstImageId = item!.visual.slots[0]!.image.id
    const updatedItem = await slotService.updateSlotSettings({
      itemId: 'item-1',
      imageId: firstImageId,
      isActive: false,
      slideshow: { enabled: true, intervalMs: 5000 },
      transition: { type: 'fade', durationMs: 600 },
    })

    expect(updatedItem.visual.slots[0]).toMatchObject({
      isActive: false,
      slideshow: { enabled: true, intervalMs: 5000 },
      transition: { type: 'fade', durationMs: 600 },
    })
    database.close()
  })
})
