import { afterEach, describe, expect, test } from 'vitest'
import { ImportPlaylistService } from '../../src/renderer/application/import-playlist-service'
import { PlaylistSourceAdapterRegistry } from '../../src/renderer/application/playlist-source-adapter-registry'
import { SqliteLocalDatabase } from '../../src/renderer/infrastructure/local-data/sqlite-local-database'
import { SqlitePlaylistRepository } from '../../src/renderer/infrastructure/local-data/sqlite-playlist-repository'
import { createPlaylistImportRegistry } from '../../src/renderer/infrastructure/import/create-playlist-import-registry'
import { EnpsTextHtmAdapter } from '../../src/renderer/infrastructure/import/enps-text-htm-adapter'
import type { ImportedPlaylist, PlaylistImportInput, PlaylistSourceAdapter } from '../../src/renderer/domain/playlist-import'
import { createLocalDatabaseFixture } from '../fixtures/local-database-fixture'
import { createReimportedTextOnlyHtmInput } from '../fixtures/import-service-fixture'
import { createTextOnlyHtmInput } from '../fixtures/playlist-import-fixture'

const fixtures: Array<{ cleanup(): Promise<void> }> = []

afterEach(async () => {
  await Promise.all(fixtures.splice(0).map((fixture) => fixture.cleanup()))
})

describe('import playlist service', () => {
  test('imports a new playlist and saves ordered items', async () => {
    const fixture = await createLocalDatabaseFixture()
    fixtures.push(fixture)

    const database = new SqliteLocalDatabase(fixture.databaseFilePath)
    const service = new ImportPlaylistService(
      createPlaylistImportRegistry(),
      database,
      () => '2026-03-26T10:00:00.000Z',
    )
    const repository = new SqlitePlaylistRepository(database)

    const result = await service.import(createTextOnlyHtmInput())
    const playlist = await repository.getPlaylist(result.playlistId)

    expect(result).toEqual({
      playlistId: 'imported:playlist',
      itemCount: 2,
      sourceAdapterId: 'enps-text-htm',
    })
    expect(playlist?.playlist.name).toBe('Morning rundown')
    expect(playlist?.items.map((item) => item.title)).toEqual([
      'OPENING HEADLINES',
      'WEATHER BRIEF',
    ])
    expect(playlist?.items.map((item) => item.orderIndex)).toEqual([0, 1])
    database.close()
  })

  test('reimport replaces the playlist items while preserving order', async () => {
    const fixture = await createLocalDatabaseFixture()
    fixtures.push(fixture)

    const database = new SqliteLocalDatabase(fixture.databaseFilePath)
    const service = new ImportPlaylistService(
      createPlaylistImportRegistry(),
      database,
      () => '2026-03-26T10:00:00.000Z',
    )
    const repository = new SqlitePlaylistRepository(database)

    await service.import(createTextOnlyHtmInput())
    await service.import(createReimportedTextOnlyHtmInput())

    const playlist = await repository.getPlaylist('imported:playlist')

    expect(playlist?.playlist.name).toBe('Morning rundown updated')
    expect(playlist?.items.map((item) => item.title)).toEqual([
      'WEATHER BRIEF',
      'CLOSING PANEL',
    ])
    expect(playlist?.items.map((item) => item.orderIndex)).toEqual([0, 1])
    database.close()
  })

  test('rolls back persisted state when import write fails', async () => {
    const fixture = await createLocalDatabaseFixture()
    fixtures.push(fixture)

    const database = new SqliteLocalDatabase(fixture.databaseFilePath)
    const repository = new SqlitePlaylistRepository(database)
    const failingStore = {
      read: () => database.read(),
      write: async (data: Awaited<ReturnType<typeof database.read>>) => {
        if (data.playlistItems.some((item) => item.id.includes('duplicate-item'))) {
          throw new Error('Simulated write failure')
        }

        await database.write(data)
      },
    }

    await new ImportPlaylistService(
      createPlaylistImportRegistry(),
      failingStore,
      () => '2026-03-26T10:00:00.000Z',
    ).import(createTextOnlyHtmInput())

    const failingRegistry: Pick<PlaylistSourceAdapterRegistry, 'import'> = {
      import: async (_input: PlaylistImportInput): Promise<ImportedPlaylist> => ({
        sourceAdapterId: 'failing-adapter',
        title: 'Broken import',
        items: [
          { externalId: 'duplicate-item', title: 'Broken 1', orderIndex: 0 },
        ],
      }),
    }

    const failingService = new ImportPlaylistService(
      failingRegistry,
      failingStore,
      () => '2026-03-26T10:00:00.000Z',
    )

    await expect(failingService.import(createTextOnlyHtmInput())).rejects.toThrow('Simulated write failure')

    const playlist = await repository.getPlaylist('imported:playlist')
    expect(playlist?.playlist.name).toBe('Morning rundown')
    expect(playlist?.items.map((item) => item.title)).toEqual([
      'OPENING HEADLINES',
      'WEATHER BRIEF',
    ])
    database.close()
  })

  test('rolls back when adapter import fails before persistence', async () => {
    const fixture = await createLocalDatabaseFixture()
    fixtures.push(fixture)

    const database = new SqliteLocalDatabase(fixture.databaseFilePath)
    const repository = new SqlitePlaylistRepository(database)
    const registry = new PlaylistSourceAdapterRegistry()
    const failingAdapter: PlaylistSourceAdapter = {
      id: 'failing-text-adapter',
      priority: 100,
      canHandle: () => true,
      importPlaylist: async () => {
        throw new Error('Parsing failed')
      },
    }
    registry.register(failingAdapter)
    registry.register(new EnpsTextHtmAdapter())

    const service = new ImportPlaylistService(registry, database, () => '2026-03-26T10:00:00.000Z')

    await expect(service.import(createTextOnlyHtmInput())).rejects.toThrow('Parsing failed')
    expect(await repository.getPlaylist('imported:playlist')).toBeNull()
    database.close()
  })
})
