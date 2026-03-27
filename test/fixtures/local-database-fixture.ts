import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

export async function createLocalDatabaseFixture() {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'electro-plasma-db-'))

  return {
    rootDir,
    databaseFilePath: path.join(rootDir, 'local-data.sqlite'),
    async cleanup() {
      await rm(rootDir, { recursive: true, force: true })
    },
  }
}
