import { access, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'
import { DownloadSelectedImagesService } from '../../src/renderer/application/download-selected-images-service'
import { LocalImageAssetService } from '../../src/renderer/infrastructure/local-assets/local-image-asset-service'
import { createImageSearchResult } from '../fixtures/image-search-fixture'
import { createLocalImageFixture } from '../fixtures/local-image-fixture'

const fixtures: Array<{ cleanup(): Promise<void> }> = []

afterEach(async () => {
  await Promise.all(fixtures.splice(0).map((fixture) => fixture.cleanup()))
})

describe('download selected images service', () => {
  test('downloads selected images locally and transforms them into image assets', async () => {
    const fixture = await createLocalImageFixture()
    fixtures.push(fixture)

    const downloadClient = {
      async downloadImage(input: { url: string; fileNameStem: string }) {
        const filePath = path.join(fixture.sourceDir, `${input.fileNameStem}.jpg`)
        await writeFile(filePath, `downloaded:${input.url}`, 'utf8')

        return {
          filePath,
          cleanup: async () => undefined,
        }
      },
    }

    const service = new DownloadSelectedImagesService(
      downloadClient,
      new LocalImageAssetService(fixture.storageDir),
    )

    const results = await service.download({
      selectedResults: [
        createImageSearchResult({ id: 'one', title: 'Anchor still' }),
        createImageSearchResult({ id: 'two', title: 'Presenter portrait', downloadUrl: 'https://images.example.com/download/presenter.jpg' }),
      ],
    })

    expect(results.failures).toHaveLength(0)
    expect(results.assets).toHaveLength(2)
    await access(results.assets[0].originalPath)
    await access(results.assets[1].previewPath)
    expect(await readFile(results.assets[0].originalPath, 'utf8')).toContain('downloaded:https://images.example.com/download/studio-skyline.jpg')
  })

  test('accepts only between one and five selected results', async () => {
    const fixture = await createLocalImageFixture()
    fixtures.push(fixture)

    const service = new DownloadSelectedImagesService(
      {
        async downloadImage() {
          throw new Error('not needed')
        },
      },
      new LocalImageAssetService(fixture.storageDir),
    )

    await expect(service.download({ selectedResults: [] })).rejects.toThrow('Select between 1 and 5 images before downloading.')
    await expect(service.download({
      selectedResults: Array.from({ length: 6 }, (_, index) => createImageSearchResult({ id: `image-${String(index)}` })),
    })).rejects.toThrow('Select between 1 and 5 images before downloading.')
  })

  test('reports partial failures without losing successful asset imports', async () => {
    const fixture = await createLocalImageFixture()
    fixtures.push(fixture)

    const downloadClient = {
      async downloadImage(input: { url: string; fileNameStem: string }) {
        if (input.url.includes('fail')) {
          throw new Error('Remote host unavailable.')
        }

        const filePath = path.join(fixture.sourceDir, `${input.fileNameStem}.png`)
        await writeFile(filePath, `downloaded:${input.url}`, 'utf8')

        return {
          filePath,
          cleanup: async () => undefined,
        }
      },
    }

    const service = new DownloadSelectedImagesService(
      downloadClient,
      new LocalImageAssetService(fixture.storageDir),
    )

    const results = await service.download({
      selectedResults: [
        createImageSearchResult({ id: 'ok-1' }),
        createImageSearchResult({ id: 'bad-1', downloadUrl: 'https://images.example.com/fail/bad-1.jpg' }),
        createImageSearchResult({ id: 'ok-2', downloadUrl: 'https://images.example.com/download/ok-2.jpg' }),
      ],
    })

    expect(results.assets).toHaveLength(2)
    expect(results.failures).toEqual([
      expect.objectContaining({
        reason: 'Remote host unavailable.',
        result: expect.objectContaining({ id: 'bad-1' }),
      }),
    ])
  })
})
