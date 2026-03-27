import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'
import { LocalImageAssetService } from '../../src/renderer/infrastructure/local-assets/local-image-asset-service'
import { createLocalImageFixture } from '../fixtures/local-image-fixture'

const fixtures: Array<{ cleanup(): Promise<void> }> = []

afterEach(async () => {
  await Promise.all(fixtures.splice(0).map((fixture) => fixture.cleanup()))
})

describe('local image asset service', () => {
  test('imports an image from a local folder and copies it into internal storage', async () => {
    const fixture = await createLocalImageFixture()
    fixtures.push(fixture)

    const sourceFilePath = await fixture.createSourceImage('hero.png', 'fake-image-content')
    const service = new LocalImageAssetService(fixture.storageDir, () => '2026-03-26T12:00:00.000Z')

    const asset = await service.importImage({ sourceFilePath })

    expect(asset.id).toMatch(/^image:/)
    expect(asset.originalPath.startsWith(path.join(fixture.storageDir, 'originals'))).toBe(true)
    expect(asset.processedPath.startsWith(path.join(fixture.storageDir, 'processed'))).toBe(true)
    expect(asset.previewPath.startsWith(path.join(fixture.storageDir, 'previews'))).toBe(true)
    expect(asset.path).toBe(asset.originalPath)
    expect(asset.mimeType).toBe('image/png')
    await access(asset.originalPath)
    await access(asset.processedPath)
    await access(asset.previewPath)
    expect(await readFile(asset.originalPath, 'utf8')).toBe('fake-image-content')
  })

  test('generates a stable internal name and path for the same source content', async () => {
    const fixture = await createLocalImageFixture()
    fixtures.push(fixture)

    const sourceFilePath = await fixture.createSourceImage('still.png', 'same-binary')
    const service = new LocalImageAssetService(fixture.storageDir)

    const firstAsset = await service.importImage({ sourceFilePath })
    const secondAsset = await service.importImage({ sourceFilePath })

    expect(firstAsset.id).toBe(secondAsset.id)
    expect(firstAsset.originalPath).toBe(secondAsset.originalPath)
    expect(firstAsset.processedPath).toBe(secondAsset.processedPath)
    expect(firstAsset.previewPath).toBe(secondAsset.previewPath)
  })
})
