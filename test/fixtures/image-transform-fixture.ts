import { copyFile, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { LocalImageAssetService } from '../../src/renderer/infrastructure/local-assets/local-image-asset-service'

const imageFixturesDir = path.resolve(__dirname, 'images')

export async function createImageTransformFixture() {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'electro-plasma-transform-'))
  const sourceDir = path.join(rootDir, 'source')
  const storageDir = path.join(rootDir, 'storage')
  await mkdir(sourceDir, { recursive: true })
  await mkdir(storageDir, { recursive: true })

  const assetService = new LocalImageAssetService(storageDir, () => '2026-03-26T12:00:00.000Z')

  return {
    rootDir,
    sourceDir,
    storageDir,
    async importSample(fileName: string) {
      const sourceFilePath = path.join(sourceDir, fileName)
      await copyFile(path.join(imageFixturesDir, fileName), sourceFilePath)

      const asset = await assetService.importImage({ sourceFilePath })
      const originalBuffer = await readFile(asset.originalPath)

      return {
        asset,
        sourceFilePath,
        originalBuffer,
      }
    },
    async cleanup() {
      await rm(rootDir, { recursive: true, force: true })
    },
  }
}
