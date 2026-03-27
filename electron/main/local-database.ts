import { app } from 'electron'
import path from 'node:path'
import { SqliteLocalDatabase } from '../../src/renderer/infrastructure/local-data/sqlite-local-database'

export function getLocalDatabaseFilePath(baseDir = app.getPath('userData')) {
  return path.join(baseDir, 'plasma.sqlite')
}

export function createMainProcessDatabase(baseDir?: string) {
  return new SqliteLocalDatabase(getLocalDatabaseFilePath(baseDir))
}
