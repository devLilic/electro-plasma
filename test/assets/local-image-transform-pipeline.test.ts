import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { afterEach, describe, expect, test } from 'vitest'
import { LocalImageTransformPipeline } from '../../src/renderer/infrastructure/local-assets/local-image-transform-pipeline'
import { createImageTransformFixture } from '../fixtures/image-transform-fixture'

const fixtures: Array<{ cleanup(): Promise<void> }> = []

afterEach(async () => {
  await Promise.all(fixtures.splice(0).map((fixture) => fixture.cleanup()))
})

describe('local image transform pipeline', () => {
  test('crops a sample image to 16:9 and writes the output into processed storage', async () => {
    const fixture = await createImageTransformFixture()
    fixtures.push(fixture)

    const { asset } = await fixture.importSample('landscape.png')
    const pipeline = new LocalImageTransformPipeline()

    const transformedAsset = await pipeline.applyTransforms({
      asset,
      operations: [{ type: 'crop-16:9' }],
    })

    expect(transformedAsset.originalPath).toBe(asset.originalPath)
    expect(transformedAsset.processedPath).not.toBe(asset.originalPath)
    expect(transformedAsset.processedPath.startsWith(path.join(fixture.storageDir, 'processed'))).toBe(true)
    expect(transformedAsset.width).toBe(1920)
    expect(transformedAsset.height).toBe(1080)
    await access(transformedAsset.processedPath)
  })

  test('supports flip, flop and rotate while keeping the original file untouched', async () => {
    const fixture = await createImageTransformFixture()
    fixtures.push(fixture)

    const { asset, originalBuffer } = await fixture.importSample('landscape.png')
    const pipeline = new LocalImageTransformPipeline()

    const transformedAsset = await pipeline.applyTransforms({
      asset,
      operations: [
        { type: 'flip' },
        { type: 'flop' },
        { type: 'rotate', degrees: 90 },
      ],
    })

    expect(await readFile(asset.originalPath)).toEqual(originalBuffer)
    expect(transformedAsset.width).toBe(300)
    expect(transformedAsset.height).toBe(400)
  })

  test('keeps editing non-destructive and updates derived asset metadata', async () => {
    const fixture = await createImageTransformFixture()
    fixtures.push(fixture)

    const { asset } = await fixture.importSample('landscape.png')
    const pipeline = new LocalImageTransformPipeline()

    const transformedAsset = await pipeline.applyTransforms({
      asset,
      operations: [{ type: 'rotate', degrees: 180 }],
    })

    expect(transformedAsset.id).toBe(asset.id)
    expect(transformedAsset.path).toBe(transformedAsset.processedPath)
    expect(transformedAsset.originalPath).toBe(asset.originalPath)
    expect(transformedAsset.previewPath.startsWith(path.join(fixture.storageDir, 'previews'))).toBe(true)
    expect(transformedAsset.previewPath).not.toBe(asset.previewPath)
    expect(transformedAsset.mimeType).toBe(asset.mimeType)
    expect(transformedAsset.createdAt).toBe(asset.createdAt)
    expect(transformedAsset.width).toBe(400)
    expect(transformedAsset.height).toBe(300)

    const previewMetadata = await sharp(transformedAsset.previewPath).metadata()
    expect(previewMetadata.width).toBe(640)
    expect(previewMetadata.height).toBe(360)
  })
})
