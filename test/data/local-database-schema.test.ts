import Database from 'better-sqlite3'
import { afterEach, describe, expect, test } from 'vitest'
import {
  LOCAL_DATABASE_VERSION,
  createEmptyLocalDatabase,
} from '../../src/renderer/domain/media-library'
import { SqliteLocalDatabase } from '../../src/renderer/infrastructure/local-data/sqlite-local-database'
import { createLocalDatabaseFixture } from '../fixtures/local-database-fixture'

const fixtures: Array<{ cleanup(): Promise<void> }> = []

afterEach(async () => {
  await Promise.all(fixtures.splice(0).map((fixture) => fixture.cleanup()))
})

describe('local database schema', () => {
  test('creates the initial schema on first read', async () => {
    const fixture = await createLocalDatabaseFixture()
    fixtures.push(fixture)

    const database = new SqliteLocalDatabase(fixture.databaseFilePath, () => '2026-03-26T00:00:00.000Z')
    const data = await database.read()

    expect(data).toEqual(createEmptyLocalDatabase('2026-03-26T00:00:00.000Z'))
    expect(data.version).toBe(LOCAL_DATABASE_VERSION)
    database.close()
  })

  test('persists schema changes and reloads them from disk', async () => {
    const fixture = await createLocalDatabaseFixture()
    fixtures.push(fixture)

    const database = new SqliteLocalDatabase(fixture.databaseFilePath, () => '2026-03-26T00:00:00.000Z')
    const initialData = await database.read()

    initialData.playlists.push({
      id: 'playlist-1',
      name: 'Morning set',
      createdAt: '2026-03-26T00:00:00.000Z',
      updatedAt: '2026-03-26T00:00:00.000Z',
    })

    await database.write(initialData)
    database.close()

    const reloadedDatabase = new SqliteLocalDatabase(fixture.databaseFilePath)
    const reloaded = await reloadedDatabase.read()
    const inspectionDatabase = new Database(fixture.databaseFilePath, { readonly: true })
    const rawOnDisk = inspectionDatabase
      .prepare(`SELECT id, name FROM playlists`)
      .all() as Array<{ id: string; name: string }>

    expect(reloaded.playlists).toHaveLength(1)
    expect(reloaded.playlists[0]?.name).toBe('Morning set')
    expect(rawOnDisk[0]?.id).toBe('playlist-1')
    inspectionDatabase.close()
    reloadedDatabase.close()
  })
})
